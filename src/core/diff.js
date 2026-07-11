import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

export function generateDiffReport({ cwd, hash, filePath }) {
  const absPath = resolve(cwd, filePath);
  // 路径校验：防止遍历到 cwd 之外
  if (!absPath.startsWith(resolve(cwd))) {
    return `❌ 错误: 文件路径 "${filePath}" 超出工作目录范围`;
  }
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

  let added = '', removed = '', common = '';
  try {
    const diffOutput = execFileSync('git', ['diff', hash, '--', filePath], {
      cwd, encoding: 'utf-8',
    });
    if (!diffOutput.trim()) {
      return [
        '┌────────────────────────────────────────',
        `│ 恢复比对报告`,
        `├─ Commit: ${commitInfo}`,
        `├─ 文件: ${filePath}`,
        '│',
        '├─ ✅ 两版本完全相同，无差异',
        `│   历史版本与当前版本一致（commit ${hash.slice(0, 8)}）`,
        '│',
        '└────────────────────────────────────────',
      ].join('\n');
    }
    const lines = diffOutput.split('\n');
    added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n') || '（无新增行）';
    removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1)).join('\n') || '（无移除行）';
    const commonLines = lines.filter(l => l.startsWith(' ')).map(l => l.slice(1));
    if (commonLines.length === 0) {
      common = '（无共有内容）';
    } else if (commonLines.length <= 20) {
      common = commonLines.join('\n');
    } else {
      const head = commonLines.slice(0, 10).join('\n');
      const tail = commonLines.slice(-10).join('\n');
      common = `${head}\n│   ... 中间 ${commonLines.length - 20} 行省略 ...\n${tail}`;
    }
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
    '├─ + 新增内容（当前有、备份无）:',
    ...added.split('\n').map(l => `│   ${l}`),
    '│',
    '├─ - 已移除内容（备份有、当前无）:',
    ...removed.split('\n').map(l => `│   ${l}`),
    '│',
    '├─ = 共有内容（两方一致）:',
    ...common.split('\n').map(l => `│   ${l}`),
    '│',
    '└────────────────────────────────────────',
  ].join('\n');
}
