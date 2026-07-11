/**
 * src/core/stats.js — buildStats 单元测试(用 fixtures,不依赖真实 git)
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

import { buildStats } from '../../src/core/stats.js';

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function bad(label, err) { failed++; console.log(`  ❌ ${label}: ${err}`); }
function check(label, cond) {
  if (cond) ok(label);
  else { failed++; console.log(`  ❌ ${label}`); }
}

function run(name, fn) {
  console.log(`\n测试: ${name}`);
  const dir = mkdtempSync(join(tmpdir(), 'cm-stats-'));
  Promise.resolve()
    .then(() => fn(dir))
    .catch((e) => { failed++; console.log(`  ❌ ${e.message}`); console.log(e.stack); })
    .finally(() => {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
      pending--;
      if (pending === 0) finish();
    });
}

let pending = 0;

function finish() {
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

function makeRepo(dir, commits) {
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'config', 'commit.gpgsign', 'false'], { cwd: dir });
  for (const { file, content, msg, date } of commits) {
    mkdirSync(join(dir, file.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(join(dir, file), content);
    execFileSync('git', ['add', file], { cwd: dir });
    const env = date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env;
    execFileSync('git', [
      '-c', 'user.name=t', '-c', 'user.email=t@t',
      'commit', '--no-verify', '--no-gpg-sign', '-m', msg,
    ], { cwd: dir, env });
  }
}

// ─── 1. 空仓库 ───
pending++;
run('buildStats: 非 git 目录 → 全零', async (dir) => {
  const r = await buildStats(dir);
  check('totalCommits=0', r.totalCommits === 0);
  check('totalFiles=0', r.totalFiles === 0);
  check('dailyActivity 空', Array.isArray(r.dailyActivity) && r.dailyActivity.length === 0);
  check('fileRanking 空', Array.isArray(r.fileRanking) && r.fileRanking.length === 0);
});

// ─── 2. 3 个 commit 跨 2 天 ───
pending++;
run('buildStats: 3 commit / 2 天聚合', async (dir) => {
  makeRepo(dir, [
    { file: 'a.md', content: 'v1', msg: 'c1', date: '2026-07-10T10:00:00+00:00' },
    { file: 'a.md', content: 'v2', msg: 'c2', date: '2026-07-10T14:00:00+00:00' },
    { file: 'b.md', content: 'v1', msg: 'c3', date: '2026-07-11T09:00:00+00:00' },
  ]);
  const r = await buildStats(dir);
  check('totalCommits=3', r.totalCommits === 3);
  check('totalFiles=2', r.totalFiles === 2);
  check('dailyActivity 长度 2', r.dailyActivity.length === 2);
  check('day[0]=2026-07-10', r.dailyActivity[0]?.fullDate === '2026-07-10');
  check('day[0] commits=2', r.dailyActivity[0]?.commits === 2);
  check('day[1] commits=1', r.dailyActivity[1]?.commits === 1);
  check('firstDate=2026-07-10', r.firstDate === '2026-07-10');
  check('lastDate=2026-07-11', r.lastDate === '2026-07-11');
});

// ─── 3. fileRanking top 1 ───
pending++;
run('buildStats: fileRanking 按修改次数降序', async (dir) => {
  makeRepo(dir, [
    { file: 'hot.md', content: 'a', msg: 'm1' },
    { file: 'cold.md', content: 'b', msg: 'm2' },
    { file: 'hot.md', content: 'aa', msg: 'm3' },
    { file: 'hot.md', content: 'aaa', msg: 'm4' },
  ]);
  const r = await buildStats(dir);
  check('rank[0]=hot.md', r.fileRanking[0]?.file === 'hot.md');
  check('rank[0] changes=3', r.fileRanking[0]?.changes === 3);
  check('rank[1]=cold.md', r.fileRanking[1]?.file === 'cold.md');
  check('rank[1] changes=1', r.fileRanking[1]?.changes === 1);
});

// ─── 4. filesChanged 真实按日(非均值摊分)───
pending++;
run('buildStats: filesChanged 真实按日统计(非均值)', async (dir) => {
  makeRepo(dir, [
    { file: 'a.md', content: 'v1', msg: 'c1', date: '2026-07-10T10:00:00+00:00' },
    { file: 'b.md', content: 'v1', msg: 'c2', date: '2026-07-10T14:00:00+00:00' },
    { file: 'a.md', content: 'v2', msg: 'c3', date: '2026-07-11T09:00:00+00:00' },
  ]);
  const r = await buildStats(dir);
  const day1 = r.dailyActivity.find(d => d.fullDate === '2026-07-10');
  const day2 = r.dailyActivity.find(d => d.fullDate === '2026-07-11');
  check('7-10 存在', !!day1);
  check('7-11 存在', !!day2);
  check('7-10 改了 2 个文件', day1?.filesChanged === 2);
  check('7-11 改了 1 个文件(非均值)', day2?.filesChanged === 1);
});

process.nextTick(() => {
  if (pending === 0) {
    console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
    process.exit(failed > 0 ? 1 : 0);
  }
});
process.on('exit', () => {
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
});
