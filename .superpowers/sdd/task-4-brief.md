# Task 4: Core init.js —— 仓库初始化

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `C:\Users\admin\config-mgr\src\core\init.js`
- Create: `C:\Users\admin\config-mgr\src\core\init.test.js`

## 接口
- `initGit(cwd)` → `{ initialized: boolean, skipped: boolean, message: string }`

## 完整代码

```javascript
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function initGit(cwd) {
  if (existsSync(join(cwd, '.git'))) {
    return { initialized: false, skipped: true, message: 'git 仓库已存在' };
  }
  try {
    execFileSync('git', ['init'], { cwd });
    const gitignoreSrc = join(TEMPLATE_DIR, 'gitignore');
    if (existsSync(gitignoreSrc)) {
      const content = readFileSync(gitignoreSrc, 'utf-8');
      writeFileSync(join(cwd, '.gitignore'), content, 'utf-8');
    }
    execFileSync('git', ['add', '.'], { cwd });
    execFileSync('git', ['commit', '--no-verify', '--no-gpg-sign', '-m', 'init: 初始配置快照'], {
      cwd,
      env: { ...process.env, GIT_COMMITTER_DATE: new Date().toISOString() },
    });
    return { initialized: true, skipped: false, message: 'git 仓库初始化完成' };
  } catch (err) {
    return { initialized: false, skipped: false, message: `初始化失败: ${err.message}` };
  }
}
```

## 步骤
1. 创建 src/core/init.js
2. 编写测试（创建临时目录、调用 initGit、验证 .git 和 .gitignore 存在、验证幂等）
3. 验证测试通过
4. 提交

## 报告
C:\Users\admin\config-mgr\.superpowers\sdd\task-4-report.md
