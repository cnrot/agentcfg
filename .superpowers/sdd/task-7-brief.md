# Task 7: Core squash.js —— 90 天历史压缩

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `C:\Users\admin\config-mgr\src\core\squash.js`
- Create: `C:\Users\admin\config-mgr\src\core\squash.test.js`

## 接口
- `squashOldHistory({ cwd, daysThreshold })` → `{ squashed: boolean, message: string }`

## 完整代码

```javascript
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export function squashOldHistory({ cwd, daysThreshold = 90 }) {
  if (!existsSync(join(cwd, '.git'))) {
    return { squashed: false, message: '不是 git 仓库' };
  }
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().replace('T', ' ').slice(0, 19);
  const oldCommits = execFileSync('git', [
    'log', `--before="${cutoffStr}"`, '--format=%H', '--reverse',
  ], { cwd, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

  if (oldCommits.length === 0) {
    return { squashed: false, message: `无超过 ${daysThreshold} 天的 commit 需要压缩` };
  }

  const oldestHash = oldCommits[0];
  try {
    const tags = execFileSync('git', ['tag', '--points-at', oldestHash], {
      cwd, encoding: 'utf-8',
    }).trim();
    if (tags) {
      return { squashed: false, message: `commit ${oldestHash.slice(0, 8)} 有 tag 豁免，跳过压缩` };
    }
  } catch {}

  try {
    execFileSync('git', ['reset', '--soft', `${oldestHash}^`], { cwd });
    execFileSync('git', ['commit', '--no-verify', '--no-gpg-sign', '-m',
      `archive: 自动压缩于 ${cutoffStr}（合并 ${oldCommits.length} 个 commit）`],
    { cwd, encoding: 'utf-8', env: { ...process.env, GIT_COMMITTER_DATE: new Date().toISOString() } });
  } catch (err) {
    return { squashed: false, message: `压缩失败: ${err.message}` };
  }

  return {
    squashed: true,
    message: `已压缩 ${oldCommits.length} 个 ${daysThreshold} 天前的 commit 为 archive commit`,
  };
}
```

## 步骤
1. 创建 src/core/squash.js（逐字符复制上方代码）
2. 创建 src/core/squash.test.js（测试：非 git 仓库跳过、无旧 commit 跳过、成功压缩）
3. 运行测试
4. 提交
5. 写入报告到: C:\Users\admin\config-mgr\.superpowers\sdd\task-7-report.md
