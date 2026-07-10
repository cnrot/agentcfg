/**
 * diff.js 测试
 * 用临时仓库验证 generateDiffReport 的各种场景
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { generateDiffReport } from './diff.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

function runTest(name, fn) {
  console.log(`\n测试: ${name}`);
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-test-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** 初始化 git 仓库并配置 user */
function initRepo(dir) {
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: dir });
}

/** 添加并提交文件，返回 commit hash */
function addCommit(repoDir, filePath, content) {
  writeFileSync(join(repoDir, filePath), content, 'utf-8');
  execFileSync('git', ['add', filePath], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', `update ${filePath}`], { cwd: repoDir });
  return execFileSync('git', ['log', '--format=%H', '--max-count=1'], { cwd: repoDir, encoding: 'utf-8' }).trim();
}

// 测试1: 有差异时报告包含新增和移除行
runTest('有差异时报告包含新增和移除行', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  initRepo(repoDir);

  const hashOld = addCommit(repoDir, 'file.txt', 'line1\nline2');
  // 工作树当前为 line1\nline3，与 hashOld 比较应显示 line3 新增、line2 移除
  addCommit(repoDir, 'file.txt', 'line1\nline3');

  const report = generateDiffReport({ cwd: repoDir, hash: hashOld, filePath: 'file.txt' });

  assert(report.includes('恢复比对报告'), '报告包含标题');
  assert(report.includes('file.txt'), '报告包含文件路径');
  assert(report.includes('line3'), '新增行包含 line3');
  assert(report.includes('line2'), '移除行包含 line2');
});

// 测试2: 文件当前不存在时正常处理
runTest('文件当前不存在时正常生成报告', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  initRepo(repoDir);

  addCommit(repoDir, 'file.txt', 'content');
  const hash = addCommit(repoDir, 'file.txt', 'content v2');

  // 从磁盘删除文件
  rmSync(join(repoDir, 'file.txt'));

  const report = generateDiffReport({ cwd: repoDir, hash, filePath: 'file.txt' });

  assert(typeof report === 'string', '返回字符串');
  assert(report.length > 0, '报告非空');
  assert(report.includes('恢复比对报告'), '报告包含标题');
  assert(report.includes('content'), 'diff 内容仍可计算');
});

// 测试3: 历史版本不存在时正常处理
runTest('历史版本不存在时正常生成报告', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  initRepo(repoDir);

  // 第一次提交没有 file.txt
  addCommit(repoDir, 'a.txt', 'hello');

  // 第二次提交才创建 file.txt
  const hash = addCommit(repoDir, 'file.txt', 'world');

  // 用第一个提交的 hash，此时 file.txt 还不存在
  const firstHash = execFileSync('git', ['log', '--format=%H', '--max-count=1', '--skip=1'], { cwd: repoDir, encoding: 'utf-8' }).trim();

  const report = generateDiffReport({ cwd: repoDir, hash: firstHash, filePath: 'file.txt' });

  assert(typeof report === 'string', '返回字符串');
  assert(report.length > 0, '报告非空');
  assert(report.includes('恢复比对报告'), '报告包含标题');
});

// 测试4: 报告格式包含 commit 信息和文件路径
runTest('报告格式包含 commit 信息和文件路径', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  initRepo(repoDir);

  const hash = addCommit(repoDir, 'test.txt', 'hello');
  const shortHash = execFileSync('git', ['log', '--format=%h', '-1', hash], { cwd: repoDir, encoding: 'utf-8' }).trim();

  const report = generateDiffReport({ cwd: repoDir, hash, filePath: 'test.txt' });

  assert(report.includes('┌'), '报告包含左上角框线字符');
  assert(report.includes('└'), '报告包含左下角框线字符');
  assert(report.includes('├─ Commit:'), '报告包含 Commit 信息');
  assert(report.includes(shortHash), '报告包含 commit hash');
  assert(report.includes('test.txt'), '报告包含文件路径');
  assert(report.includes('两版本完全相同'), '无差异时提示版本一致');
  assert(!report.includes('├─ + 新增内容'), '无差异时不显示三段式标题');
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
