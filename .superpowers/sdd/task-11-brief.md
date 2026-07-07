# Task 11: OpenCode hook 适配器

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `src/hooks/opencode.js`
- Create: `src/hooks/opencode.test.js`

## 完整代码（src/hooks/opencode.js）

```javascript
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function installOpencodeHooks(opencodeDir) {
  const pluginsDir = join(opencodeDir, 'plugins');
  const targetPath = join(pluginsDir, 'config-mgr.ts');
  if (existsSync(targetPath)) {
    return { installed: false, message: 'OpenCode 插件已存在，跳过' };
  }
  mkdirSync(pluginsDir, { recursive: true });
  const template = readFileSync(join(TEMPLATE_DIR, 'plugin-opencode.ts'), 'utf-8');
  writeFileSync(targetPath, template, 'utf-8');
  return { installed: true, message: 'OpenCode 插件安装成功' };
}

export function uninstallOpencodeHooks(opencodeDir) {
  const targetPath = join(opencodeDir, 'plugins/config-mgr.ts');
  if (!existsSync(targetPath)) {
    return { uninstalled: false, message: 'OpenCode 插件不存在' };
  }
  writeFileSync(targetPath + '.bak', readFileSync(targetPath, 'utf-8'), 'utf-8');
  rmSync(targetPath);
  return { uninstalled: true, message: 'OpenCode 插件已移除' };
}
```

## 步骤
1. 创建 src/hooks/opencode.js（逐字符复制）
2. 创建测试（安装、幂等跳过、卸载、目录不存在时优雅处理）
3. 运行测试全部通过
4. 提交 + 报告
