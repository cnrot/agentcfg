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
    const diffOutput = execFileSync('git', ['diff', hash, '--', filePath], {
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
