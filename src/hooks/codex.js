import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

const FEATURE_FLAG_TOML = `# config-mgr: 启用 hooks 支持（由 config-mgr 自动添加）
[features]
hooks = true
`;

export function installCodexHooks(codexDir, commitScriptPath) {
  const hooksPath = join(codexDir, 'hooks.json');
  if (existsSync(hooksPath)) {
    const existing = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    if (existing.hooks?.PreToolUse?.some(e =>
      e.hooks?.some(h => h.command?.includes('commit.js'))
    )) {
      return { installed: false, message: 'Codex hooks 已注册，跳过' };
    }
  }
  const template = readFileSync(join(TEMPLATE_DIR, 'hooks-codex.json'), 'utf-8');
  const filled = template.replaceAll('__COMMIT_SCRIPT__', commitScriptPath);
  writeFileSync(hooksPath, filled, 'utf-8');

  const configPath = join(codexDir, 'config.toml');
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, 'utf-8');
    if (!config.includes('[features]')) {
      writeFileSync(configPath, config.trimEnd() + '\n\n' + FEATURE_FLAG_TOML, 'utf-8');
    } else if (!config.includes('hooks = true')) {
      const updated = config.replace('[features]', '[features]\nhooks = true');
      writeFileSync(configPath, updated, 'utf-8');
    }
  } else {
    writeFileSync(configPath, FEATURE_FLAG_TOML, 'utf-8');
  }
  return { installed: true, message: 'Codex CLI hooks 注册成功（含 feature flag 开启）' };
}

export function uninstallCodexHooks(codexDir) {
  const hooksPath = join(codexDir, 'hooks.json');
  if (existsSync(hooksPath)) {
    const content = readFileSync(hooksPath, 'utf-8');
    writeFileSync(hooksPath + '.bak', content, 'utf-8');
    const hooks = JSON.parse(content);
    if (hooks.hooks?.PreToolUse) {
      hooks.hooks.PreToolUse = hooks.hooks.PreToolUse.filter(e =>
        !e.hooks?.some(h => h.command?.includes('commit.js'))
      );
    }
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n', 'utf-8');
  }
  const configPath = join(codexDir, 'config.toml');
  if (existsSync(configPath)) {
    let config = readFileSync(configPath, 'utf-8');
    config = config.replace('hooks = true', 'hooks = false');
    writeFileSync(configPath, config, 'utf-8');
  }
  return { uninstalled: true, message: 'Codex CLI hooks 已移除' };
}
