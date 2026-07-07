# Task 3: Core commit.js —— hook 核心脚本

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `C:\Users\admin\config-mgr\src\core\commit.js`

## 接口
- 输出函数: `commit({ cwd, source, toolName })` → `{ committed: boolean, message: string }`

## 完整代码

```javascript
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * 在目标目录检测未提交变更并自动提交
 * @param {object} opts
 * @param {string} opts.cwd - 工作目录（有 .git 的目录）
 * @param {string} [opts.source='hook'] - 触发来源 (pre_tool, pre_shell, post_edit)
 * @param {string} [opts.toolName='unknown'] - 触发工具名
 * @returns {{ committed: boolean, message: string }}
 */
export function commit({ cwd, source = 'hook', toolName = 'unknown' }) {
  if (!existsSync(cwd)) {
    return { committed: false, message: `目录不存在: ${cwd}` };
  }
  if (!existsSync(join(cwd, '.git'))) {
    return { committed: false, message: '不是 git 仓库，跳过提交' };
  }
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd, encoding: 'utf-8',
  }).trim();
  if (!status) {
    return { committed: false, message: '无未提交变更，跳过' };
  }
  execFileSync('git', ['add', '.'], { cwd, encoding: 'utf-8' });
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const message = `auto: snapshot before ${toolName} at ${timestamp}`;
  execFileSync('git', ['commit', '--no-verify', '--no-gpg-sign', '-m', message], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, GIT_COMMITTER_DATE: new Date().toISOString() },
  });
  return { committed: true, message };
}
```

## 步骤
1. 创建 src/core/commit.js（完整代码如上）
2. 编写 inline 测试（用临时目录验证功能的完整性）：
   - 测试1: 创建temp目录→git init→init commit→改文件→commit.js应返回committed: true
   - 测试2: 刚提交完无改动→commit.js应返回committed: false（零开销）
   - 测试3: 目标目录无.git→应返回committed: false
   - 测试4: 目标目录不存在→应返回committed: false
3. 验证测试全部通过
4. 提交: `git add src/core/commit.js && git commit -m "feat: implement core commit auto-snapshot logic"`

## 报告文件
完成后写入 C:\Users\admin\config-mgr\.superpowers\sdd\task-3-report.md
