# Task 6: Core diff.js —— 三段式比对报告

项目目录: C:\Users\admin\config-mgr

## 文件
- Create: `C:\Users\admin\config-mgr\src\core\diff.js`
- Create: `C:\Users\admin\config-mgr\src\core\diff.test.js`

## 接口
- `generateDiffReport({ cwd, hash, filePath })` → `string`（格式化报告）

## 完整代码

```javascript
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export function generateDiffReport({ cwd, hash, filePath }) {
  const absPath = join(cwd, filePath);
  let currentContent = '';
  let oldContent = '';

  try {
    currentContent = readFileSync(absPath, 'utf-8');
  } catch {
    currentContent = '（文件当前不存在）';
  }

  try {
    oldContent = execFileSync('git', ['show', `${hash}:${filePath}`], {
      cwd, encoding: 'utf-8',
    });
  } catch {
    oldContent = '（历史版本中不存在此文件）';
  }

  const commitInfo = execFileSync('git', ['log', '--format=%h %ci %s', '-1', hash], {
    cwd, encoding: 'utf-8',
  }).trim();

  let added = '', removed = '';
  try {
    const diffOutput = execFileSync('git', ['diff', `${hash}^..${hash}`, '--', filePath], {
      cwd, encoding: 'utf-8',
    });
    const lines = diffOutput.split('\n');
    added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n') || '（无新增行）';
    removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1)).join('\n') || '（无移除行）';
  } catch {
    added = '（无法计算差异）';
    removed = '（无法计算差异）';
  }

  return [
    '┌────────────────────────────────────────',
    `│ 恢复比对报告`,
    `├─ Commit: ${commitInfo}`,
    `├─ 文件: ${filePath}`,
    '│',
    '├─ + 新增内容（备份有、当前无）:',
    ...added.split('\n').map(l => `│   ${l}`),
    '│',
    '├─ - 已移除内容（当前有、备份无）:',
    ...removed.split('\n').map(l => `│   ${l}`),
    '│',
    '└────────────────────────────────────────',
  ].join('\n');
}
```

## 测试场景
1. 有差异时报告包含新增和移除行
2. 文件当前不存在时提示"文件当前不存在"
3. 历史版本不存在时提示"历史版本中不存在此文件"
4. 报告格式包含 commit 信息和文件路径

## 步骤
1. 创建 src/core/diff.js（逐字符复制上方代码）
2. 创建 src/core/diff.test.js
3. 运行测试
4. 提交: `git add src/core/diff.js src/core/diff.test.js && git commit -m "feat: implement three-section diff report generator"`
5. 写入报告到: C:\Users\admin\config-mgr\.superpowers\sdd\task-6-report.md
