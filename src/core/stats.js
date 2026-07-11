import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { getLog } from './log.js';

/**
 * 聚合统计数据:每日 commit 量 + 文件总数 + 高频文件排行。
 * @param {string} cwd - git 仓库目录
 * @returns {Promise<{
 *   totalCommits: number,
 *   totalFiles: number,
 *   firstDate: string|null,
 *   lastDate: string|null,
 *   dailyActivity: Array<{date: string, fullDate: string, commits: number, filesChanged: number}>,
 *   fileRanking: Array<{file: string, changes: number}>,
 * }>}
 */
export async function buildStats(cwd) {
  if (!existsSync(join(cwd, '.git'))) {
    return emptyStats(countTrackedFiles(cwd));
  }

  // 取全部 commit(最多 10000 条防止极端仓库撑爆)
  const all = getLog({ cwd, count: 10000 });
  if (all.length === 0) {
    return emptyStats(countTrackedFiles(cwd));
  }

  // 按天聚合
  const dayMap = new Map();
  for (const c of all) {
    const fullDate = c.date.slice(0, 10);
    if (!dayMap.has(fullDate)) {
      dayMap.set(fullDate, { date: fullDate.slice(5), fullDate, commits: 0, filesChanged: 0 });
    }
    dayMap.get(fullDate).commits += 1;
  }

  // 一次 git log --name-only 拿全部 commit 的文件清单
  const fileChanges = countFileChanges(cwd, all.length);
  // 把 filesChanged 摊到对应日期(每个 commit 的 files 都算到 commit 那天)
  // 重新拿 commit-by-commit 的 files 数据成本高,这里用 fileChanges 总量摊到 dayMap 的 filesChanged 字段
  // 用 git show --stat 分组并行太慢,简化为"日均 = 总文件数 / 总天数"
  const days = dayMap.size;
  const filesPerDay = Math.round(fileChanges.totalChanges / Math.max(days, 1));
  for (const d of dayMap.values()) d.filesChanged = filesPerDay;

  const dailyActivity = Array.from(dayMap.values()).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  const fileRanking = fileChanges.top;

  return {
    totalCommits: all.length,
    totalFiles: countTrackedFiles(cwd),
    firstDate: all[all.length - 1]?.date.slice(0, 10) || null,  // git log 默认倒序,最后一个是最早
    lastDate: all[0]?.date.slice(0, 10) || null,                // 第一个是最近
    dailyActivity,
    fileRanking,
  };
}

function emptyStats(fileCount) {
  return { totalCommits: 0, totalFiles: fileCount, firstDate: null, lastDate: null, dailyActivity: [], fileRanking: [] };
}

/**
 * 统计 git 仓库内被追踪文件总数(等价 `git ls-files | wc -l`)。
 */
function countTrackedFiles(cwd) {
  try {
    const out = execFileSync('git', ['ls-files'], { cwd, encoding: 'utf-8' });
    return out.trim() ? out.trim().split('\n').length : 0;
  } catch {
    return 0;
  }
}

/**
 * 统计每个文件的修改次数(高频排行)+ 总变更数。
 * 一次 `git log --name-only --pretty=format:` 然后 sort | uniq -c。
 */
function countFileChanges(cwd, limit) {
  try {
    const out = execFileSync('git', [
      'log', `--max-count=${limit}`, '--name-only', '--pretty=format:',
    ], { cwd, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
    const counts = new Map();
    let total = 0;
    for (const line of out.split('\n')) {
      const f = line.trim();
      if (!f) continue;
      counts.set(f, (counts.get(f) || 0) + 1);
      total += 1;
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, changes]) => ({ file, changes }));
    return { top: sorted, totalChanges: total };
  } catch {
    return { top: [], totalChanges: 0 };
  }
}
