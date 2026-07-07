import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function installCursorHooks(cursorDir, commitScriptPath) {
  const hooksPath = join(cursorDir, 'hooks.json');
  let existingHooks = {};
  if (existsSync(hooksPath)) {
    existingHooks = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    if (existingHooks.hooks?.beforeShellExecution?.some(
      h => h.command?.includes('commit.js')
    )) {
      return { installed: false, message: 'agentcfg hooks 已注册，跳过' };
    }
  }
  // 备份原文件
  if (existsSync(hooksPath)) {
    writeFileSync(hooksPath + '.bak', readFileSync(hooksPath, 'utf-8'), 'utf-8');
  }
  const templatePath = join(TEMPLATE_DIR, 'hooks-cursor.json');
  let templateStr = readFileSync(templatePath, 'utf-8');
  const escapedPath = commitScriptPath.replace(/\\/g, '\\\\');
  templateStr = templateStr.replaceAll('__COMMIT_SCRIPT__', escapedPath);
  const newHooks = JSON.parse(templateStr);
  // 合并：保留用户已有 hooks，追加 agentcfg 条目
  const merged = {
    version: 1,
    hooks: {
      beforeShellExecution: [
        ...(existingHooks.hooks?.beforeShellExecution || []),
        ...(newHooks.hooks?.beforeShellExecution || []),
      ],
      afterFileEdit: [
        ...(existingHooks.hooks?.afterFileEdit || []),
        ...(newHooks.hooks?.afterFileEdit || []),
      ],
    },
  };
  writeFileSync(hooksPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  return { installed: true, message: 'agentcfg hooks 注册成功' };
}

export function uninstallCursorHooks(cursorDir) {
  const hooksPath = join(cursorDir, 'hooks.json');
  if (!existsSync(hooksPath)) {
    return { uninstalled: false, message: 'hooks.json 不存在' };
  }
  const content = readFileSync(hooksPath, 'utf-8');
  writeFileSync(hooksPath + '.bak', content, 'utf-8');
  const hooks = JSON.parse(content);
  if (hooks.hooks?.beforeShellExecution) {
    hooks.hooks.beforeShellExecution = hooks.hooks.beforeShellExecution.filter(
      h => !h.command?.includes('commit.js')
    );
  }
  if (hooks.hooks?.afterFileEdit) {
    hooks.hooks.afterFileEdit = hooks.hooks.afterFileEdit.filter(
      h => !h.command?.includes('commit.js')
    );
  }
  writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n', 'utf-8');
  return { uninstalled: true, message: 'agentcfg hooks 已移除' };
}
