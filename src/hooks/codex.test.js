/**
 * codex.js 测试
 * 用临时目录模拟 hooks.json 和 config.toml 测试安装、幂等、卸载、feature flag
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installCodexHooks, uninstallCodexHooks } from './codex.js';

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
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-codex-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Test 1: 安装成功 - 正常注册 hooks 并创建 config.toml
runTest('install succeeds and creates hooks.json + config.toml', (tmpDir) => {
  const result = installCodexHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === true, 'installed 应为 true');
  assert(result.message === 'agentcfg hooks 注册成功（含 feature flag 开启）', '消息应提示注册成功');

  // 验证 hooks.json 存在且包含正确内容
  const hooksPath = join(tmpDir, 'hooks.json');
  assert(existsSync(hooksPath), 'hooks.json 应已创建');

  const raw = readFileSync(hooksPath, 'utf-8');
  const hooks = JSON.parse(raw);
  assert(hooks.hooks?.PreToolUse !== undefined, 'PreToolUse 应存在');
  assert(Array.isArray(hooks.hooks.PreToolUse), 'PreToolUse 应为数组');
  assert(hooks.hooks.PreToolUse.length > 0, 'PreToolUse 应包含条目');
  assert(hooks.hooks.PreToolUse[0].hooks?.some(h => h.command?.includes('/usr/bin/commit.js')),
    '命令应包含 commit.js 路径');

  // 验证 config.toml 被创建
  const configPath = join(tmpDir, 'config.toml');
  assert(existsSync(configPath), 'config.toml 应已创建');
  const config = readFileSync(configPath, 'utf-8');
  assert(config.includes('[features]'), 'config.toml 应包含 [features]');
  assert(config.includes('hooks = true'), 'config.toml 应包含 hooks = true');
});

// Test 2: 重复安装幂等 - 第二次应跳过
runTest('re-install is idempotent (skips)', (tmpDir) => {
  installCodexHooks(tmpDir, '/usr/bin/commit.js');
  const result = installCodexHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === false, 'installed 应为 false');
  assert(result.message === 'agentcfg hooks 已注册，跳过', '消息应提示已注册跳过');
});

// Test 3: 卸载成功 - 移除 hooks 条目并关闭 feature flag
runTest('uninstall removes hooks entries and disables feature', (tmpDir) => {
  installCodexHooks(tmpDir, '/usr/bin/commit.js');
  const result = uninstallCodexHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message === 'agentcfg hooks 已移除', '消息应提示已移除');

  // 验证备份文件存在
  assert(existsSync(join(tmpDir, 'hooks.json.bak.agentcfg')), '备份文件 hooks.json.bak.agentcfg 应存在');

  // 验证 hooks.json 中的 commit.js 条目已被移除
  const raw = readFileSync(join(tmpDir, 'hooks.json'), 'utf-8');
  const hooks = JSON.parse(raw);
  const hasCommit = hooks.hooks?.PreToolUse?.some(e =>
    e.hooks?.some(h => h.command?.includes('commit.js'))
  );
  assert(!hasCommit, 'PreToolUse 不应包含 commit.js 条目');

  // 验证 config.toml feature flag 已关闭
  const config = readFileSync(join(tmpDir, 'config.toml'), 'utf-8');
  assert(config.includes('hooks = false'), 'config.toml 应包含 hooks = false');
});

// Test 4: config.toml 已有内容但无 [features] 段时追加
runTest('appends [features] when config.toml exists without it', (tmpDir) => {
  writeFileSync(join(tmpDir, 'config.toml'), '# existing config\napp = "my-app"\n', 'utf-8');
  installCodexHooks(tmpDir, '/usr/bin/commit.js');

  const config = readFileSync(join(tmpDir, 'config.toml'), 'utf-8');
  assert(config.includes('[features]'), 'config.toml 应包含 [features]');
  assert(config.includes('hooks = true'), 'config.toml 应包含 hooks = true');
  assert(config.includes('# existing config'), '原有内容应保留');
  assert(config.includes('app = "my-app"'), '原有内容应保留');
});

// Test 5: config.toml 不存在时创建
runTest('creates config.toml when it does not exist', (tmpDir) => {
  const configPath = join(tmpDir, 'config.toml');
  assert(!existsSync(configPath), 'config.toml 初始应不存在');

  installCodexHooks(tmpDir, '/usr/bin/commit.js');

  assert(existsSync(configPath), 'config.toml 应被创建');
  const config = readFileSync(configPath, 'utf-8');
  assert(config.includes('[features]'), 'config.toml 应包含 [features]');
  assert(config.includes('hooks = true'), 'config.toml 应包含 hooks = true');
});

// Test 6: 已有 hooks = false 时能正确切换为 true
runTest('toggles hooks = false to hooks = true', (tmpDir) => {
  const configPath = join(tmpDir, 'config.toml');
  writeFileSync(configPath, '# existing config\n[features]\nhooks = false\nother = true', 'utf-8');

  installCodexHooks(tmpDir, '/usr/bin/commit.js');

  const config = readFileSync(configPath, 'utf-8');
  assert(config.includes('hooks = true'), 'hooks 应已切换为 true');
  assert(!config.includes('hooks = false'), '不应再包含 hooks = false');
  assert(config.includes('other = true'), '其他配置应保留');
});

// Test 7: hooks=false 无空格时也能正确切换
runTest('handles hooks=false without spaces', (tmpDir) => {
  const configPath = join(tmpDir, 'config.toml');
  writeFileSync(configPath, '[features]\nhooks=false\n', 'utf-8');

  installCodexHooks(tmpDir, '/usr/bin/commit.js');

  const config = readFileSync(configPath, 'utf-8');
  assert(config.includes('hooks = true'), 'hooks 应已切换为 true');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
