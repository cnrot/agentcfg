/**
 * src/core/stats.js — buildStats 单元测试(用 fixtures,不依赖真实 git)
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

import { buildStats } from './stats.js';

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function bad(label, err) { failed++; console.log(`  ❌ ${label}: ${err}`); }

function run(name, fn) {
  console.log(`\n测试: ${name}`);
  const dir = mkdtempSync(join(tmpdir(), 'cm-stats-'));
  try { fn(dir); }
  catch (e) { bad(name, e.message); }
  finally { rmSync(dir, { recursive: true, force: true }); }
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
run('buildStats: 非 git 目录 → 全零', async (dir) => {
  const r = await buildStats(dir);
  assert.equal(r.totalCommits, 0);
  assert.equal(r.totalFiles, 0);
  assert.deepEqual(r.dailyActivity, []);
  assert.deepEqual(r.fileRanking, []);
});

// ─── 2. 3 个 commit 跨 2 天 ───
run('buildStats: 3 commit / 2 天聚合', async (dir) => {
  makeRepo(dir, [
    { file: 'a.md', content: 'v1', msg: 'c1', date: '2026-07-10T10:00:00+00:00' },
    { file: 'a.md', content: 'v2', msg: 'c2', date: '2026-07-10T14:00:00+00:00' },
    { file: 'b.md', content: 'v1', msg: 'c3', date: '2026-07-11T09:00:00+00:00' },
  ]);
  const r = await buildStats(dir);
  assert.equal(r.totalCommits, 3);
  assert.equal(r.totalFiles, 2);
  assert.equal(r.dailyActivity.length, 2, '2 天');
  assert.equal(r.dailyActivity[0].fullDate, '2026-07-10');
  assert.equal(r.dailyActivity[0].commits, 2);
  assert.equal(r.dailyActivity[1].commits, 1);
  assert.equal(r.firstDate, '2026-07-10');
  assert.equal(r.lastDate, '2026-07-11');
});

// ─── 3. fileRanking top 1 ───
run('buildStats: fileRanking 按修改次数降序', async (dir) => {
  makeRepo(dir, [
    { file: 'hot.md', content: 'a', msg: 'm1' },
    { file: 'cold.md', content: 'b', msg: 'm2' },
    { file: 'hot.md', content: 'aa', msg: 'm3' },
    { file: 'hot.md', content: 'aaa', msg: 'm4' },
  ]);
  const r = await buildStats(dir);
  assert.equal(r.fileRanking[0].file, 'hot.md');
  assert.equal(r.fileRanking[0].changes, 3);
  assert.equal(r.fileRanking[1].file, 'cold.md');
  assert.equal(r.fileRanking[1].changes, 1);
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
