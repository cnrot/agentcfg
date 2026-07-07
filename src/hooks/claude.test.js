/**
 * claude.js 测试
 * 用临时目录模拟 settings.json 测试安装、幂等、卸载、文件不存在
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installClaudeHooks, uninstallClaudeHooks } from './claude.js';

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
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-hooks-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 创建模拟 settings.json
function createSettings(dir, overrides = {}) {
  const settings = {
    hooks: overrides.hooks || {},
    ...overrides,
  };
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

// Test 1: 安装成功 - 正常注册 hooks
runTest('install succeeds with valid settings.json', (tmpDir) => {
  createSettings(tmpDir, { hooks: {} });
  const result = installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === true, 'installed 应为 true');
  assert(result.message === 'agentcfg hooks 注册成功', '消息应提示注册成功');

  // 验证 settings.json 包含 hooks
  const raw = readFileSync(join(tmpDir, 'settings.json'), 'utf-8');
  const settings = JSON.parse(raw);
  assert(Array.isArray(settings.hooks?.PreToolUse), 'PreToolUse 应为数组');
  assert(settings.hooks.PreToolUse.length > 0, 'PreToolUse 应包含条目');

  // 验证备份文件存在
  assert(existsSync(join(tmpDir, 'settings.json.bak.agentcfg')), '备份文件应存在');
});

// Test 2: 重复安装幂等 - 第二次应跳过
runTest('re-install is idempotent (skips)', (tmpDir) => {
  createSettings(tmpDir, { hooks: {} });
  installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  const result = installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === false, 'installed 应为 false');
  assert(result.message === 'agentcfg hooks 已注册，跳过', '消息应提示已注册跳过');
});

// Test 3: 卸载成功 - 从备份恢复
runTest('uninstall restores from backup', (tmpDir) => {
  createSettings(tmpDir, { hooks: {} });
  installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  const result = uninstallClaudeHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message === '已从备份恢复 settings.json', '消息应提示从备份恢复');

  // 验证恢复后的 settings 没有 hooks
  const raw = readFileSync(join(tmpDir, 'settings.json'), 'utf-8');
  const settings = JSON.parse(raw);
  assert(!settings.hooks?.PreToolUse, '恢复后不应有 PreToolUse');
});

// Test 4: 无备份时卸载 - 从 settings.json 剥离 hooks
runTest('uninstall removes hooks without backup', (tmpDir) => {
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'all',
          hooks: [
            {
              type: 'command',
              command: '/usr/bin/commit.js --source pre_tool',
              statusMessage: 'agentcfg: 检测配置文件变更',
            },
          ],
        },
      ],
    },
  };
  writeFileSync(join(tmpDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  const result = uninstallClaudeHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message === 'agentcfg hooks 已移除', '消息应提示已移除');

  const raw = readFileSync(join(tmpDir, 'settings.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  assert(!parsed.hooks?.PreToolUse, '卸载后不应有 PreToolUse');
});

// Test 5: settings.json 不存在时安装
runTest('install handles missing settings.json', (tmpDir) => {
  const result = installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  assert(result.installed === false, 'installed 应为 false');
  assert(result.message === 'settings.json 不存在', '消息应提示文件不存在');
});

// Test 6: settings.json 不存在时卸载
runTest('uninstall handles missing settings.json', (tmpDir) => {
  const result = uninstallClaudeHooks(tmpDir);
  assert(result.uninstalled === false, 'uninstalled 应为 false');
  assert(result.message === 'settings.json 不存在', '消息应提示文件不存在');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
