import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function installClaudeHooks(claudeDir, commitScriptPath) {
  const settingsPath = join(claudeDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    return { installed: false, message: 'settings.json 不存在' };
  }
  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  // 先做幂等检测，再备份
  if (settings.hooks?.PreToolUse?.some(h =>
    h.hooks?.some(hk => hk.command?.includes('commit.js'))
  )) {
    return { installed: false, message: 'agentcfg hooks 已注册，跳过' };
  }
  const backupPath = settingsPath + '.bak.agentcfg';
  copyFileSync(settingsPath, backupPath);
  const templatePath = join(TEMPLATE_DIR, 'hooks-claude.json');
  const template = JSON.parse(readFileSync(templatePath, 'utf-8'));
  // 转义 Windows 路径中的反斜杠，避免 JSON.parse 失败
  const escapedPath = commitScriptPath.replace(/\\/g, '\\\\');
  const escapedDir = claudeDir.replace(/\\/g, '\\\\');
  const hookConfig = JSON.parse(
    JSON.stringify(template)
      .replaceAll('__COMMIT_SCRIPT__', escapedPath)
      .replaceAll('__CONFIG_DIR__', escapedDir)
  );
  settings.hooks = settings.hooks || {};
  settings.hooks.PreToolUse = [
    ...(settings.hooks.PreToolUse || []),
    ...hookConfig.hooks.PreToolUse,
  ];
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return { installed: true, message: 'agentcfg hooks 注册成功' };
}

export function uninstallClaudeHooks(claudeDir) {
  const settingsPath = join(claudeDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    return { uninstalled: false, message: 'settings.json 不存在' };
  }

  // 优先从 settings.json 中增量剥离 agentcfg 条目
  // 这样能保留其他工具注册的 hooks（MCP 等），避免"恢复备份"一刀切
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    let modified = false;

    // 1. 移除 hooks.PreToolUse 中的 agentcfg 条目
    if (settings.hooks?.PreToolUse) {
      const before = settings.hooks.PreToolUse.length;
      settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(h =>
        !h.hooks?.some(hk => hk.command?.includes('commit.js'))
      );
      if (settings.hooks.PreToolUse.length !== before) modified = true;
      if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    }

    // 2. 移除 enabledPlugins 中所有 key 含 "agentcfg" 的条目
    if (settings.enabledPlugins && typeof settings.enabledPlugins === 'object') {
      const before = Object.keys(settings.enabledPlugins).length;
      for (const key of Object.keys(settings.enabledPlugins)) {
        if (key.toLowerCase().includes('agentcfg')) {
          delete settings.enabledPlugins[key];
        }
      }
      if (Object.keys(settings.enabledPlugins).length === 0) {
        delete settings.enabledPlugins;
      }
      if (Object.keys(settings.enabledPlugins || {}).length !== before) modified = true;
    }

    // 3. 移除 extraKnownMarketplaces 中含 "agentcfg" 的源
    // extraKnownMarketplaces 可能是 object（{ "name": { source: {...} } }）或 array（[{source: "..."}]）
    if (Array.isArray(settings.extraKnownMarketplaces)) {
      const before = settings.extraKnownMarketplaces.length;
      settings.extraKnownMarketplaces = settings.extraKnownMarketplaces.filter(m => {
        const source = typeof m === 'string' ? m : (m?.source || '');
        return !source.toLowerCase().includes('agentcfg');
      });
      if (settings.extraKnownMarketplaces.length === 0) {
        delete settings.extraKnownMarketplaces;
      }
      if ((settings.extraKnownMarketplaces || []).length !== before) modified = true;
    } else if (settings.extraKnownMarketplaces && typeof settings.extraKnownMarketplaces === 'object') {
      // object 格式：按 key 名匹配（含 "agentcfg" 子串的 key 整条删除）
      const beforeKeys = Object.keys(settings.extraKnownMarketplaces);
      for (const key of beforeKeys) {
        if (key.toLowerCase().includes('agentcfg')) {
          delete settings.extraKnownMarketplaces[key];
        }
      }
      if (Object.keys(settings.extraKnownMarketplaces).length === 0) {
        delete settings.extraKnownMarketplaces;
      }
      if (Object.keys(settings.extraKnownMarketplaces || {}).length !== beforeKeys.length) modified = true;
    }

    if (modified) {
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
      return { uninstalled: true, message: 'agentcfg hooks 已移除（含 enabledPlugins / extraKnownMarketplaces 清理）' };
    }
    return { uninstalled: true, message: 'agentcfg hooks 未找到，无需卸载' };
  } catch {
    // settings.json 损坏时不再盲目从备份恢复
    // 原因：备份后用户可能已编辑过 settings.json，盲目覆盖会丢失用户的修改
    // 此时让用户手动修复或检查文件
    return { uninstalled: false, message: 'settings.json 解析失败，请手动检查或修复' };
  }
}
