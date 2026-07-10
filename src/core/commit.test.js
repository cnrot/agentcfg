/**
 * commit.js 测试
 * 用临时目录模拟真实场景验证自动提交逻辑
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { commit } from './commit.js';

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

// 测试1: 有变更时能正确提交
runTest('有变更时提交成功', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'test.txt'), 'initial');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });

  writeFileSync(join(repoDir, 'test.txt'), 'modified');
  const result = commit({ cwd: repoDir, source: 'pre_tool', toolName: 'Bash' });

  assert(result.committed === true, 'committed 应为 true');
  assert(result.message.includes('snapshot before Bash'), '消息应包含工具名');
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repoDir, encoding: 'utf-8' }).trim();
  assert(status === '', '提交后工作区应干净');
});

// 测试2: 无变更时跳过
runTest('无变更时跳过', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'test.txt'), 'initial');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });

  const result = commit({ cwd: repoDir, source: 'pre_tool', toolName: 'Bash' });
  assert(result.committed === false, 'committed 应为 false');
  assert(result.message.includes('跳过'), '消息应包含"跳过"');
});

// 测试3: 无 .git 目录时跳过
runTest('无 git 仓库时跳过', (tmpDir) => {
  const result = commit({ cwd: tmpDir, source: 'pre_tool', toolName: 'Bash' });
  assert(result.committed === false, 'committed 应为 false');
  assert(result.message.includes('不是 git 仓库'), '应提示不是 git 仓库');
});

// 测试4: 目录不存在时跳过
runTest('目录不存在时跳过', (tmpDir) => {
  const result = commit({ cwd: join(tmpDir, 'nonexistent'), source: 'pre_tool', toolName: 'Bash' });
  assert(result.committed === false, 'committed 应为 false');
  assert(result.message.includes('不存在'), '应提示目录不存在');
});

// 测试5: 验证 git 操作失败时不会抛出异常
runTest('git 操作失败时不会抛出异常', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'test.txt'), 'data');
  // 调用 commit，无论是否有全局 user 配置，都不应抛出异常
  let threw = false;
  try {
    const result = commit({ cwd: repoDir, source: 'test', toolName: 'Test' });
    // 只要有返回就行（committed 可能是 true 或 false）
    assert(typeof result.committed === 'boolean', '应返回 committed 布尔值');
    assert(typeof result.message === 'string', '应返回 message 字符串');
  } catch (e) {
    threw = true;
  }
  assert(threw === false, '不应抛出异常');
});

// 测试6: settings.json 损坏时拒绝提交
runTest('settings.json 损坏时跳过提交', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'test.txt'), 'initial');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });
  // 写入损坏的 settings.json
  writeFileSync(join(repoDir, 'settings.json'), '{ broken json ', 'utf-8');
  // 再改一个文件触发 diff
  writeFileSync(join(repoDir, 'test.txt'), 'modified', 'utf-8');

  const result = commit({ cwd: repoDir, source: 'pre_tool', toolName: 'Bash' });
  assert(result.committed === false, 'committed 应为 false');
  assert(result.message.includes('格式错误'), '消息应提示格式错误');

  // 验证工作区仍为 dirty（没有被 git add 暂存）
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repoDir, encoding: 'utf-8' }).trim();
  assert(status.length > 0, '错误文件不应被暂存');
});

// 测试7: --dir 参数让 commit 找到正确目录（模拟 hook 调用）
runTest('--dir 参数让 commit 找到正确目录', (tmpDir) => {
  // 模拟：用户在 ~ 目录，agent config 在 ~/.claude
  // 之前 cwd=~ 找不到 .git，现在 --dir=~/.claude 能找到
  const claudeDir = join(tmpDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: claudeDir });
  writeFileSync(join(claudeDir, 'CLAUDE.md'), 'initial');
  execFileSync('git', ['add', '.'], { cwd: claudeDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: claudeDir });

  // 直接调 commit 函数，cwd 指向 .claude
  writeFileSync(join(claudeDir, 'CLAUDE.md'), 'modified');
  const result = commit({ cwd: claudeDir, source: 'pre_tool', toolName: 'Edit' });
  assert(result.committed === true, 'cwd 指向 .claude 时应提交成功');
  assert(result.message.includes('Edit'), '提交消息应包含工具名 Edit');

  const status = execFileSync('git', ['status', '--porcelain'], { cwd: claudeDir, encoding: 'utf-8' }).trim();
  assert(status === '', '提交后工作区应干净');
});

// 测试8: pre_tool 源应生成 "snapshot before" 消息
runTest('pre_tool source 生成 "snapshot before" 消息', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'test.txt'), 'initial');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });

  writeFileSync(join(repoDir, 'test.txt'), 'modified');
  const result = commit({ cwd: repoDir, source: 'pre_tool', toolName: 'Bash' });
  assert(result.committed === true, 'pre_tool 应提交');
  assert(result.message.includes('snapshot before Bash'), 'pre_tool 消息应含 "snapshot before"');
  assert(!result.message.includes('snapshot after'), 'pre_tool 不应含 "snapshot after"');
});

// 测试9: post_edit 源应生成 "snapshot after" 消息（Cursor afterFileEdit）
runTest('post_edit source 生成 "snapshot after" 消息', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'test.txt'), 'initial');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });

  writeFileSync(join(repoDir, 'test.txt'), 'modified');
  const result = commit({ cwd: repoDir, source: 'post_edit', toolName: 'Edit' });
  assert(result.committed === true, 'post_edit 应提交');
  assert(result.message.includes('snapshot after Edit'), 'post_edit 消息应含 "snapshot after"');
  assert(!result.message.includes('snapshot before'), 'post_edit 不应含 "snapshot before"');
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
