# Task 9: Cursor hook 适配器

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `src/hooks/cursor.js`
- Create: `src/hooks/cursor.test.js`

## 完整代码（src/hooks/cursor.js）

```javascript
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function installCursorHooks(cursorDir, commitScriptPath) {
  const hooksPath = join(cursorDir, 'hooks.json');
  if (existsSync(hooksPath)) {
    const existing = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    const hasConfigMgr = existing.hooks?.beforeShellExecution?.some(
      h => h.command?.includes('commit.js')
    );
    if (hasConfigMgr) {
      return { installed: false, message: 'Cursor hooks 已注册，跳过' };
    }
  }
  const templatePath = join(TEMPLATE_DIR, 'hooks-cursor.json');
  let templateStr = readFileSync(templatePath, 'utf-8');
  templateStr = templateStr.replaceAll('__COMMIT_SCRIPT__', commitScriptPath);
  writeFileSync(hooksPath, templateStr, 'utf-8');
  return { installed: true, message: 'Cursor hooks 注册成功' };
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
  return { uninstalled: true, message: 'Cursor hooks 已移除' };
}
```

## 步骤
1. 创建 src/hooks/cursor.js（逐字符复制）
2. 创建测试（安装、幂等、卸载）
3. 运行测试全部通过
4. 提交 + 报告
