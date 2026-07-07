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
  const backupPath = settingsPath + '.bak.config-mgr';
  copyFileSync(settingsPath, backupPath);
  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  const templatePath = join(TEMPLATE_DIR, 'hooks-claude.json');
  const template = JSON.parse(readFileSync(templatePath, 'utf-8'));
  const hookConfig = JSON.parse(
    JSON.stringify(template).replaceAll('__COMMIT_SCRIPT__', commitScriptPath)
  );
  if (settings.hooks?.PreToolUse?.some(h =>
    h.hooks?.some(hk => hk.command?.includes('commit.js'))
  )) {
    return { installed: false, message: 'Claude Code hooks 已注册，跳过' };
  }
  settings.hooks = settings.hooks || {};
  settings.hooks.PreToolUse = [
    ...(settings.hooks.PreToolUse || []),
    ...hookConfig.hooks.PreToolUse,
  ];
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return { installed: true, message: 'Claude Code hooks 注册成功' };
}

export function uninstallClaudeHooks(claudeDir) {
  const settingsPath = join(claudeDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    return { uninstalled: false, message: 'settings.json 不存在' };
  }
  const backupPath = settingsPath + '.bak.config-mgr';
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, settingsPath);
    return { uninstalled: true, message: '已从备份恢复 settings.json' };
  }
  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  if (settings.hooks?.PreToolUse) {
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(h =>
      !h.hooks?.some(hk => hk.command?.includes('commit.js'))
    );
    if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }
  return { uninstalled: true, message: 'Claude Code hooks 已移除' };
}
