/**
 * cursor.js 测试
 * 用临时目录模拟 hooks.json 测试安装、幂等、卸载、文件不存在
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installCursorHooks, uninstallCursorHooks } from '../../src/hooks/cursor.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ok ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}

function runTest(name, fn) {
  console.log(`\nTest: ${name}`);
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-cursor-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Test 1: 安装成功 - 正常注册 hooks
runTest('install succeeds and creates hooks.json', (tmpDir) => {
  const result = installCursorHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === true, 'installed 应为 true');
  assert(result.message === 'agentcfg hooks 注册成功', '消息应提示注册成功');

  // 验证 hooks.json 存在且包含正确内容
  const hooksPath = join(tmpDir, 'hooks.json');
  assert(existsSync(hooksPath), 'hooks.json 应已创建');

  const raw = readFileSync(hooksPath, 'utf-8');
  const hooks = JSON.parse(raw);
  assert(hooks.version === 1, 'version 应为 1');
  assert(Array.isArray(hooks.hooks?.beforeShellExecution), 'beforeShellExecution 应为数组');
  assert(hooks.hooks.beforeShellExecution.length > 0, 'beforeShellExecution 应包含条目');
  assert(hooks.hooks.beforeShellExecution[0].command.includes('/usr/bin/commit.js'),
    '命令应包含 commit.js 路径');
});

// Test 2: 重复安装幂等 - 第二次应跳过
runTest('re-install is idempotent (skips)', (tmpDir) => {
  installCursorHooks(tmpDir, '/usr/bin/commit.js');
  const result = installCursorHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === false, 'installed 应为 false');
  assert(result.message === 'agentcfg hooks 已注册，跳过', '消息应提示已注册跳过');
});

// Test 3: 卸载成功 - 移除 hooks 条目
runTest('uninstall removes hooks entries', (tmpDir) => {
  installCursorHooks(tmpDir, '/usr/bin/commit.js');
  const result = uninstallCursorHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message === 'agentcfg hooks 已移除', '消息应提示已移除');

  // 验证备份文件存在
  assert(existsSync(join(tmpDir, 'hooks.json.bak.agentcfg')), '备份文件 hooks.json.bak.agentcfg 应存在');

  // 验证 hooks.json 中的 commit.js 条目已被移除
  const raw = readFileSync(join(tmpDir, 'hooks.json'), 'utf-8');
  const hooks = JSON.parse(raw);
  const hasCommitInBefore = hooks.hooks?.beforeShellExecution?.some(
    h => h.command?.includes('commit.js')
  );
  const hasCommitInAfter = hooks.hooks?.afterFileEdit?.some(
    h => h.command?.includes('commit.js')
  );
  assert(!hasCommitInBefore, 'beforeShellExecution 不应包含 commit.js 条目');
  assert(!hasCommitInAfter, 'afterFileEdit 不应包含 commit.js 条目');
});

// Test 4: hooks.json 不存在时卸载 - 优雅处理
runTest('uninstall handles missing hooks.json gracefully', (tmpDir) => {
  const result = uninstallCursorHooks(tmpDir);
  assert(result.uninstalled === false, 'uninstalled 应为 false');
  assert(result.message === 'hooks.json 不存在', '消息应提示文件不存在');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
