/**
 * opencode.js 测试
 * 用临时目录模拟 OpenCode 插件目录测试安装、幂等、卸载、文件不存在
 */
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installOpencodeHooks, uninstallOpencodeHooks } from './opencode.js';

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
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-opencode-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Test 1: 安装成功 - 创建 plugins 目录和插件文件
runTest('install succeeds and creates plugin file', (tmpDir) => {
  const opencodeDir = join(tmpDir, '.opencode');
  const result = installOpencodeHooks(opencodeDir);
  assert(result.installed === true, 'installed 应为 true');
  assert(result.message === 'agentcfg 插件安装成功', '消息应提示安装成功');

  const targetPath = join(opencodeDir, 'plugins/agentcfg.ts');
  assert(existsSync(targetPath), '插件文件应已创建');

  const content = readFileSync(targetPath, 'utf-8');
  assert(content.includes('ConfigMgrPlugin'), '插件文件应包含 ConfigMgrPlugin 内容');
});

// Test 2: 重复安装幂等 - 第二次应跳过
runTest('re-install is idempotent (skips)', (tmpDir) => {
  const opencodeDir = join(tmpDir, '.opencode');
  installOpencodeHooks(opencodeDir);
  const result = installOpencodeHooks(opencodeDir);
  assert(result.installed === false, 'installed 应为 false');
  assert(result.message === 'agentcfg 插件已存在，跳过', '消息应提示跳过');
});

// Test 2.5: 模板更新时自动覆盖
runTest('template update replaces old plugin with backup', (tmpDir) => {
  const opencodeDir = join(tmpDir, '.opencode');
  const pluginsDir = join(opencodeDir, 'plugins');
  mkdirSync(pluginsDir, { recursive: true });
  const targetPath = join(pluginsDir, 'agentcfg.ts');
  // 写入旧版内容
  writeFileSync(targetPath, '// old stub content', 'utf-8');

  const result = installOpencodeHooks(opencodeDir);
  assert(result.installed === true, 'installed 应为 true');
  assert(result.message === 'agentcfg 插件已更新', '消息应提示已更新');

  // 验证备份文件存在
  assert(existsSync(targetPath + '.bak.agentcfg'), '备份文件应存在');
  // 验证最终内容是模板内容（不是旧版 stub）
  const content = readFileSync(targetPath, 'utf-8');
  assert(content.includes('ConfigMgrPlugin'), '文件内容应为模板内容');
  // 验证备份内容是旧版
  const backup = readFileSync(targetPath + '.bak.agentcfg', 'utf-8');
  assert(backup === '// old stub content', '备份文件应包含旧版内容');
});

// Test 3: 卸载成功 - 移除插件文件并创建备份
runTest('uninstall removes plugin file and creates backup', (tmpDir) => {
  const opencodeDir = join(tmpDir, '.opencode');
  installOpencodeHooks(opencodeDir);
  const result = uninstallOpencodeHooks(opencodeDir);
  assert(result.uninstalled === true, 'uninstalled 应为 true');
  assert(result.message === 'agentcfg 插件已移除', '消息应提示已移除');

  const targetPath = join(opencodeDir, 'plugins/agentcfg.ts');
  assert(!existsSync(targetPath), '插件文件应已删除');
  assert(existsSync(targetPath + '.bak.agentcfg'), '备份文件应存在');
});

// Test 4: 插件不存在时卸载 - 优雅处理
runTest('uninstall handles missing plugin gracefully', (tmpDir) => {
  const opencodeDir = join(tmpDir, '.opencode');
  const result = uninstallOpencodeHooks(opencodeDir);
  assert(result.uninstalled === false, 'uninstalled 应为 false');
  assert(result.message === 'agentcfg 插件不存在', '消息应提示插件不存在');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
