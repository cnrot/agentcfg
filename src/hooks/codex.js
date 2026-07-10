import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

const FEATURE_FLAG_TOML = `# agentcfg: 启用 hooks 支持（由 agentcfg 自动添加）
[features]
hooks = true
`;

const META_FILENAME = 'config.toml.agentcfg-meta';

/**
 * 解析 config.toml 中现有的 hooks 值
 * @returns {string|null} 'true' / 'false' / null（未设置）
 */
function readHooksValue(configText) {
  const m = configText.match(/^hooks\s*=\s*(true|false)\s*$/m);
  return m ? m[1] : null;
}

/**
 * 写入 agentcfg 元数据，记录安装前的 hooks 状态
 */
function writeMeta(codexDir, originalHooksValue, hadFeaturesSection) {
  const metaPath = join(codexDir, META_FILENAME);
  writeFileSync(metaPath, JSON.stringify({
    originalHooksValue,    // 'true' | 'false' | null
    hadFeaturesSection,    // boolean
  }), 'utf-8');
}

export function installCodexHooks(codexDir, commitScriptPath) {
  const hooksPath = join(codexDir, 'hooks.json');
  if (existsSync(hooksPath)) {
    const existing = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    if (existing.hooks?.PreToolUse?.some(e =>
      e.hooks?.some(h => h.command?.includes('commit.js'))
    )) {
      return { installed: false, message: 'agentcfg hooks 已注册，跳过' };
    }
  }
  const template = readFileSync(join(TEMPLATE_DIR, 'hooks-codex.json'), 'utf-8');
  // 转义 Windows 路径中的反斜杠，避免 JSON.parse 失败
  const escapedPath = commitScriptPath.replace(/\\/g, '\\\\');
  const escapedDir = codexDir.replace(/\\/g, '\\\\');
  const filled = template
    .replaceAll('__COMMIT_SCRIPT__', escapedPath)
    .replaceAll('__CONFIG_DIR__', escapedDir);
  // 备份 hooks.json（如果已存在）
  if (existsSync(hooksPath)) {
    writeFileSync(hooksPath + '.bak.agentcfg', readFileSync(hooksPath, 'utf-8'), 'utf-8');
  }
  writeFileSync(hooksPath, filled, 'utf-8');

  const configPath = join(codexDir, 'config.toml');
  // 备份原 config.toml
  if (existsSync(configPath)) {
    writeFileSync(configPath + '.bak.agentcfg', readFileSync(configPath, 'utf-8'), 'utf-8');
  }
  const metaPath = join(codexDir, META_FILENAME);
  // 如果元数据已存在（再次安装/交错场景），保持首次安装的原始值，避免错乱卸载
  const existingMeta = existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, 'utf-8'))
    : null;
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, 'utf-8');
    if (existingMeta) {
      // 复用首次安装时记录的原始状态，不重新读取（防止与并发修改/手动编辑混淆）
      writeMeta(codexDir, existingMeta.originalHooksValue, existingMeta.hadFeaturesSection);
    } else {
      // 记录安装前的 hooks 状态，用于卸载时还原
      const originalHooksValue = readHooksValue(config);
      const hadFeaturesSection = /^\[features\]\s*$/m.test(config);
      writeMeta(codexDir, originalHooksValue, hadFeaturesSection);
    }

    if (/^hooks\s*=\s*false\s*$/m.test(config)) {
      writeFileSync(configPath, config.replace(/^hooks\s*=\s*false\s*$/m, 'hooks = true'), 'utf-8');
    } else if (!config.includes('[features]')) {
      writeFileSync(configPath, config.trimEnd() + '\n\n' + FEATURE_FLAG_TOML, 'utf-8');
    } else if (!config.includes('hooks = true')) {
      const updated = config.replace('[features]', '[features]\nhooks = true');
      writeFileSync(configPath, updated, 'utf-8');
    }
  } else {
    // 新建 config.toml，原始未设置任何 hooks 值
    writeMeta(codexDir, null, false);
    writeFileSync(configPath, FEATURE_FLAG_TOML, 'utf-8');
  }
  return { installed: true, message: 'agentcfg hooks 注册成功（含 feature flag 开启）' };
}

export function uninstallCodexHooks(codexDir) {
  const hooksPath = join(codexDir, 'hooks.json');
  if (existsSync(hooksPath)) {
    const content = readFileSync(hooksPath, 'utf-8');
    writeFileSync(hooksPath + '.bak.agentcfg', readFileSync(hooksPath, 'utf-8'), 'utf-8');
    const hooks = JSON.parse(content);
    if (hooks.hooks?.PreToolUse) {
      hooks.hooks.PreToolUse = hooks.hooks.PreToolUse.filter(e =>
        !e.hooks?.some(h => h.command?.includes('commit.js'))
      );
    }
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n', 'utf-8');
  }
  const configPath = join(codexDir, 'config.toml');
  const metaPath = join(codexDir, META_FILENAME);
  if (existsSync(configPath)) {
    let config = readFileSync(configPath, 'utf-8');
    if (existsSync(metaPath)) {
      // 有元数据：按原始状态还原
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        if (meta.originalHooksValue === null) {
          // 原始未设置 hooks：移除 agentcfg 添加的 hooks = true
          config = config.replace(/^hooks\s*=\s*true\s*$/m, '');
          // 原始没有 [features] 段：连同 agentcfg 添加的整段都拆掉
          if (meta.hadFeaturesSection === false) {
            config = config.replace(/# agentcfg:[^\n]*\n\[features\]\nhooks\s*=\s*true\n?/g, '');
          }
          // 折叠多余的空行
          config = config.replace(/\n{3,}/g, '\n\n');
        } else {
          // 还原为原始值（true/false）
          config = config.replace(/^hooks\s*=\s*true\s*$/m, `hooks = ${meta.originalHooksValue}`);
        }
        rmSync(metaPath);
      } catch {
        // 元数据损坏时保守处理：恢复为 hooks = false
        config = config.replace(/^hooks\s*=\s*true\s*$/m, 'hooks = false');
      }
    } else {
      // 无元数据（旧版本安装）：保守关闭
      config = config.replace(/^hooks\s*=\s*true$/m, 'hooks = false');
    }
    writeFileSync(configPath, config, 'utf-8');
  }
  return { uninstalled: true, message: 'agentcfg hooks 已移除' };
}
