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
  assert(settings.hooks.PreToolUse.length >= 4, 'PreToolUse 应包含 Bash/Edit/Write/MultiEdit 4 个条目');

  // 验证 --dir 参数被替换到 command 中
  const commands = settings.hooks.PreToolUse.flatMap(h => h.hooks || []).map(h => h.command);
  // tmpDir 在 Windows 上可能是 C:\Users\...\AppData\Local\Temp\...，含反斜杠
  // 转义后 cmd 实际看到的是 C:\\Users\\...，所以 --dir 后面跟转义后的路径
  // 简化：只检查 --dir 参数存在
  const allHaveDir = commands.every(c => c.includes('--dir '));
  assert(allHaveDir, '所有 hook 命令应包含 --dir 参数');

  // 验证覆盖了 Bash/Edit/Write/MultiEdit 4 个工具
  const tools = new Set();
  for (const c of commands) {
    if (c.includes('--tool Bash')) tools.add('Bash');
    if (c.includes('--tool Edit')) tools.add('Edit');
    if (c.includes('--tool Write')) tools.add('Write');
    if (c.includes('--tool MultiEdit')) tools.add('MultiEdit');
  }
  assert(tools.size === 4, `应覆盖 4 个工具，实际 ${[...tools].join(',')}`);

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

// Test 3: 卸载优先走增量剥离（不依赖备份恢复）
runTest('uninstall prefers incremental stripping over backup', (tmpDir) => {
  createSettings(tmpDir, { hooks: {} });
  installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  const result = uninstallClaudeHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message.includes('agentcfg hooks 已移除'), '消息应提示增量移除');

  // 备份文件应保留（不用于恢复，避免丢掉其他工具的 hooks）
  const backupPath = join(tmpDir, 'settings.json.bak.agentcfg');
  assert(existsSync(backupPath), '备份文件应仍存在');

  // 验证卸载后 settings 没有 agentcfg 条目
  const raw = readFileSync(join(tmpDir, 'settings.json'), 'utf-8');
  const settings = JSON.parse(raw);
  assert(!settings.hooks?.PreToolUse, '卸载后不应有 PreToolUse');
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
  assert(result.message.includes('agentcfg hooks 已移除'), '消息应提示已移除');

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

// Test 7: settings.json 损坏时从备份恢复
runTest('uninstall restores from backup when settings.json is corrupt', (tmpDir) => {
  // 创建有效的 settings.json 并安装
  createSettings(tmpDir, { hooks: {} });
  installClaudeHooks(tmpDir, '/usr/bin/commit.js');
  // 损坏 settings.json
  writeFileSync(join(tmpDir, 'settings.json'), '{ broken json', 'utf-8');

  const result = uninstallClaudeHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message === '已从备份恢复 settings.json', '消息应提示从备份恢复');

  // 验证恢复后的 settings.json 是合法的 JSON
  const raw = readFileSync(join(tmpDir, 'settings.json'), 'utf-8');
  const settings = JSON.parse(raw);
  assert(typeof settings === 'object', '恢复后应为合法 JSON');
});

// Test 8: enabledPlugins 清理 - 剥离 agentcfg 条目，保留其他插件
runTest('uninstall cleans enabledPlugins but keeps other plugins', (tmpDir) => {
  const settings = {
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'agentcfg commit --source pre_tool' }],
      }],
    },
    enabledPlugins: {
      'agentcfg@local': true,
      'karpathy@somewhere': true,
      'agentcfg-disabled@old': false,
    },
  };
  writeFileSync(join(tmpDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  const result = uninstallClaudeHooks(tmpDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');

  const after = JSON.parse(readFileSync(join(tmpDir, 'settings.json'), 'utf-8'));
  assert(after.enabledPlugins && after.enabledPlugins['karpathy@somewhere'] === true,
    '其他插件应保留');
  assert(!after.enabledPlugins['agentcfg@local'], 'agentcfg@local 应被剥离');
  assert(!after.enabledPlugins['agentcfg-disabled@old'], '含 agentcfg 子串的 key 应被剥离');
});

// Test 9: extraKnownMarketplaces object 格式清理
runTest('uninstall cleans extraKnownMarketplaces in object format', (tmpDir) => {
  const settings = {
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'agentcfg commit --source pre_tool' }],
      }],
    },
    extraKnownMarketplaces: {
      'agentcfg-marketplace': { source: { source: 'github', repo: 'xxx/agentcfg' } },
      'karpathy-skills': { source: { source: 'github', repo: 'yyy/karpathy' } },
    },
  };
  writeFileSync(join(tmpDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  uninstallClaudeHooks(tmpDir);

  const after = JSON.parse(readFileSync(join(tmpDir, 'settings.json'), 'utf-8'));
  assert(after.extraKnownMarketplaces && after.extraKnownMarketplaces['karpathy-skills'],
    '其他 marketplace 应保留');
  assert(!after.extraKnownMarketplaces['agentcfg-marketplace'],
    'agentcfg-marketplace 应被剥离');
});

// Test 10: extraKnownMarketplaces array 格式清理（保留向后兼容）
runTest('uninstall cleans extraKnownMarketplaces in array format', (tmpDir) => {
  const settings = {
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'agentcfg commit' }],
      }],
    },
    // Claude 实际行为：array 元素的 source 字段直接是 marketplace 名（含 agentcfg 子串）
    extraKnownMarketplaces: [
      { source: 'agentcfg-marketplace' },
      { source: 'other-marketplace' },
    ],
  };
  writeFileSync(join(tmpDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  uninstallClaudeHooks(tmpDir);

  const after = JSON.parse(readFileSync(join(tmpDir, 'settings.json'), 'utf-8'));
  assert(Array.isArray(after.extraKnownMarketplaces), 'array 格式应保留');
  assert(after.extraKnownMarketplaces.length === 1, 'array 应只剩 1 项');
  assert(after.extraKnownMarketplaces[0].source === 'other-marketplace',
    '剩余项应是 other-marketplace');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
