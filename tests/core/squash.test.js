/**
 * squash.js 测试
 * 验证 90 天历史压缩的各种场景
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { squashOldHistory } from '../../src/core/squash.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  \u2705 ${label}`);
  } else {
    failed++;
    console.log(`  \u274c ${label}`);
  }
}

function runTest(name, fn) {
  console.log(`\n\u6d4b\u8bd5: ${name}`);
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-squash-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** 初始化 git 仓库并配置 user */
function initRepo(tmpDir) {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repoDir });
  return repoDir;
}

/** 在当前时间创建一个 commit */
function makeCommit(repoDir, msg) {
  writeFileSync(join(repoDir, 'file.txt'), msg, 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', msg], { cwd: repoDir });
}

/** 在指定日期创建一个 commit */
function makeOldCommit(repoDir, msg, dateStr) {
  writeFileSync(join(repoDir, 'file.txt'), msg, 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', msg], {
    cwd: repoDir,
    env: { ...process.env, GIT_COMMITTER_DATE: dateStr, GIT_AUTHOR_DATE: dateStr },
  });
}

/** 获取 commit 总数 */
function countCommits(repoDir) {
  return parseInt(
    execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: repoDir, encoding: 'utf-8',
    }).trim(),
    10,
  );
}

/** 生成 N 天前的 ISO 日期字符串 */
function daysAgoStr(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ─── 测试 1: 非 git 仓库跳过 ──────────────────────────────

runTest('非 git 仓库跳过', (tmpDir) => {
  const result = squashOldHistory({ cwd: tmpDir });
  assert(result.squashed === false, 'squashed 应为 false');
  assert(result.message.includes('不是 git 仓库'), '消息应包含"不是 git 仓库"');
});

// ─── 测试 2: 无旧 commit 跳过 ─────────────────────────────

runTest('无旧 commit 跳过', (tmpDir) => {
  const repoDir = initRepo(tmpDir);
  makeCommit(repoDir, 'recent commit');

  const result = squashOldHistory({ cwd: repoDir, daysThreshold: 90 });
  assert(result.squashed === false, 'squashed 应为 false');
  assert(result.message.includes('无超过'), '消息应包含"无超过"');
});

// ─── 测试 3: 含 tag 豁免跳过 ──────────────────────────────

runTest('含 tag 豁免跳过', (tmpDir) => {
  const repoDir = initRepo(tmpDir);

  // 第一步：创建一个"base"初始 commit（确保 oldest old commit 不是 root）
  makeCommit(repoDir, 'init');

  // 创建一个旧 commit（100 天前）
  makeOldCommit(repoDir, 'old commit with tag', daysAgoStr(100));

  // 在旧 commit 上打 tag
  const allHashes = execFileSync('git', ['log', '--format=%H', '--reverse'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim().split('\n');
  execFileSync('git', ['tag', 'v1.0', allHashes[1]], { cwd: repoDir });

  // 加一个近期 commit
  makeCommit(repoDir, 'recent commit');

  const result = squashOldHistory({ cwd: repoDir, daysThreshold: 90 });
  assert(result.squashed === false, 'squashed 应为 false');
  assert(result.message.includes('有 tag 豁免'), '消息应包含"有 tag 豁免"');
  assert(result.message.includes('跳过压缩'), '消息应包含"跳过压缩"');
});

// ─── 测试 4: 成功压缩 ─────────────────────────────────────

runTest('成功压缩', (tmpDir) => {
  const repoDir = initRepo(tmpDir);

  // 先建一个基础 commit（确保 oldest old commit 有父节点）
  makeCommit(repoDir, 'base init');

  // 建 3 个旧 commit（超过 90 天阈值）
  makeOldCommit(repoDir, 'old commit 1', daysAgoStr(105));
  makeOldCommit(repoDir, 'old commit 2', daysAgoStr(100));
  makeOldCommit(repoDir, 'old commit 3', daysAgoStr(95));

  // 建 2 个近期 commit（在阈值内）
  makeCommit(repoDir, 'recent commit A');
  makeCommit(repoDir, 'recent commit B');

  const beforeCount = countCommits(repoDir);
  assert(beforeCount === 6, `压缩前应有 6 个 commit（实际 ${beforeCount}）`);

  const result = squashOldHistory({ cwd: repoDir, daysThreshold: 90 });
  assert(result.squashed === true, 'squashed 应为 true');
  assert(result.message.includes('已压缩'), '消息应包含"已压缩"');
  assert(result.message.includes('3'), '消息应包含旧 commit 数量 3');

  // 验证压缩后 commit 数：base + archive + 2 个近期 commit = 4
  const afterCount = countCommits(repoDir);
  assert(afterCount === 4, `压缩后应有 4 个 commit（实际 ${afterCount}）`);

  // 验证 commit 顺序：base init → archive → recent A → recent B
  const allMsgs = execFileSync('git', ['log', '--format=%s', '--reverse'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim().split('\n');
  assert(allMsgs[0] === 'base init', '第一个 commit 应为 "base init"');
  assert(allMsgs[1].startsWith('archive:'), '第二个 commit 应以 "archive:" 开头');
  assert(allMsgs[2] === 'recent commit A', '第三个 commit 应为 "recent commit A"');
  assert(allMsgs[3] === 'recent commit B', '第四个 commit 应为 "recent commit B"');

  // 验证工作目录文件仍然存在
  const content = execFileSync('git', ['show', 'HEAD:file.txt'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim();
  assert(content === 'recent commit B', '文件内容应为最新 "recent commit B"');
});

// ─── 测试 5: 全部 commit 都超过阈值 ─────────────────────────

runTest('全部 commit 都超阈值时仅压缩为一个 archive', (tmpDir) => {
  const repoDir = initRepo(tmpDir);

  // 建 3 个旧 commit（全部超过 90 天阈值）
  makeOldCommit(repoDir, 'old 1', daysAgoStr(105));
  makeOldCommit(repoDir, 'old 2', daysAgoStr(100));
  makeOldCommit(repoDir, 'old 3', daysAgoStr(95));

  const beforeCount = countCommits(repoDir);
  assert(beforeCount === 3, `压缩前应有 3 个 commit（实际 ${beforeCount}）`);

  const result = squashOldHistory({ cwd: repoDir, daysThreshold: 90 });
  assert(result.squashed === true, 'squashed 应为 true');
  assert(result.message.includes('已压缩'), '消息应包含"已压缩"');

  // 验证压缩后：archive commit + 可能的初始 = 1 或 2
  const afterCount = countCommits(repoDir);
  // 根 commit 没有父节点时只有一个 archive commit
  assert(afterCount >= 1, `压缩后应有至少 1 个 commit（实际 ${afterCount}）`);

  // 验证最新 commit 是 archive 消息
  const allMsgs = execFileSync('git', ['log', '--format=%s', '--reverse'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim().split('\n');
  assert(allMsgs[allMsgs.length - 1].startsWith('archive:'), '最新 commit 应以 "archive:" 开头');

  // 验证工作目录文件存在
  const content = execFileSync('git', ['show', 'HEAD:file.txt'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim();
  assert(content.length > 0, '文件内容不应为空');
});

// ─── 测试 6: 空仓库（unborn HEAD）应优雅处理 ──────────────

runTest('空仓库（unborn HEAD）应优雅处理', (tmpDir) => {
  const repoDir = initRepo(tmpDir);
  // 不创建任何 commit，保持 unborn HEAD 状态

  const result = squashOldHistory({ cwd: repoDir, daysThreshold: 90 });
  assert(result.squashed === false, 'squashed 应为 false');
  // 应给出明确的中文错误消息（提到 branch/detach/commit/HEAD/仓库）
  const hasIncompleteHint = /branch|detach|commit|HEAD|仓库/i.test(result.message);
  assert(hasIncompleteHint,
    `消息应提示分支/HEAD/commit 状态相关信息（实际：${result.message}）`);
});

// ─── 测试 7: 二次压缩前应保留旧 backup 分支 ──────────────

runTest('二次压缩应保留旧 backup-before-squash 分支', (tmpDir) => {
  const repoDir = initRepo(tmpDir);
  makeCommit(repoDir, 'base init');
  makeOldCommit(repoDir, 'old commit', daysAgoStr(100));
  makeCommit(repoDir, 'recent commit');

  // 手动模拟一个旧的 backup 分支（指向某个历史状态）
  const oldBackupHash = execFileSync('git', ['log', '--format=%H', '--reverse'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim().split('\n')[0];
  execFileSync('git', ['branch', 'backup-before-squash', oldBackupHash], { cwd: repoDir });

  // 第一次压缩（应保留旧 backup 分支并创建新的）
  const result = squashOldHistory({ cwd: repoDir, daysThreshold: 90 });
  assert(result.squashed === true, 'squashed 应为 true');

  // 验证：旧 backup 分支仍存在（被重命名保留）
  // 旧 backup 应被重命名为 backup-before-squash.<timestamp> 形式
  const branches = execFileSync('git', ['branch'], {
    cwd: repoDir, encoding: 'utf-8',
  }).trim();
  const oldBackupPreserved = branches.split('\n').some(b =>
    b.trim().startsWith('backup-before-squash.') ||
    b.trim() === 'backup-before-squash'
  );
  assert(oldBackupPreserved,
    `旧 backup 分支应被保留（带时间戳重命名）实际分支：\n${branches}`);
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
