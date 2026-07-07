/**
 * recover.js 测试
 * 模拟 .claude/ 目录场景验证 recover 逻辑
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import recover from './recover.js';

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

/**
 * 在临时目录下构建 ~/.claude git 仓库
 */
function setupGitRepo(baseDir) {
  const claudeDir = join(baseDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: claudeDir, encoding: 'utf-8' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: claudeDir, encoding: 'utf-8' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: claudeDir, encoding: 'utf-8' });
  writeFileSync(join(claudeDir, 'test.txt'), 'hello world\nline2\n');
  execFileSync('git', ['add', '-A'], { cwd: claudeDir, encoding: 'utf-8' });
  execFileSync('git', ['commit', '-m', '初始提交 test.txt'], { cwd: claudeDir, encoding: 'utf-8' });
  return claudeDir;
}

/**
 * 捕获 console.log 输出并异步执行 fn
 */
async function captureLog(fn) {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.log = origLog;
  }
  return logs.join('\n');
}

async function runTest(name, fn) {
  console.log(`\n测试: ${name}`);
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-recover-'));
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  const origHomeDrive = process.env.HOMEDRIVE;
  const origHomePath = process.env.HOMEPATH;

  try {
    // Redirect os.homedir() by overriding env vars
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    // Clear HOMEDRIVE/HOMEPATH to prevent interference
    delete process.env.HOMEDRIVE;
    delete process.env.HOMEPATH;

    await fn(tmpDir);
  } finally {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origUserProfile;
    if (origHomeDrive !== undefined) process.env.HOMEDRIVE = origHomeDrive;
    else delete process.env.HOMEDRIVE;
    if (origHomePath !== undefined) process.env.HOMEPATH = origHomePath;
    else delete process.env.HOMEPATH;
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest('1. 无 .git 时提示错误', async (tmpDir) => {
    // 只创建 .claude 目录，不初始化 git
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'some-config.json'), '{}');

    const output = await captureLog(() => recover());
    assert(output.includes('未初始化'), '应提示目录未初始化 git 仓库');
    assert(output.includes('config-mgr init'), '应提示执行 init');
  });

  await runTest('2. 有 git 仓库时输出恢复指引', async (tmpDir) => {
    setupGitRepo(tmpDir);

    const output = await captureLog(() => recover());
    assert(output.includes('config-mgr 恢复指引'), '应显示恢复指引标题');
    assert(output.includes('初始提交 test.txt'), '应包含提交消息');
    assert(output.includes('常见操作'), '应显示常见操作列表');
  });

  await runTest('3. 指定文件时显示文件历史', async (tmpDir) => {
    setupGitRepo(tmpDir);

    const output = await captureLog(() => recover('test.txt'));
    assert(output.includes('test.txt'), '应包含文件名');
    assert(output.includes('初始提交 test.txt'), '应包含提交消息');
    assert(output.includes('修改历史'), '应显示修改历史标题');
    assert(output.includes('比对后选择性恢复'), '应显示比对接力提示');
  });

  await runTest('4. 指定不存在文件时提示无历史', async (tmpDir) => {
    setupGitRepo(tmpDir);

    const output = await captureLog(() => recover('nonexistent.txt'));
    assert(output.includes('nonexistent.txt'), '应包含文件名');
    assert(output.includes('没有历史记录'), '应提示无历史记录');
  });

  await runTest('5. .claude 目录不存在时提示', async (tmpDir) => {
    // 不创建任何目录
    const output = await captureLog(() => recover());
    assert(output.includes('未初始化'), '应提示目录未初始化 git 仓库');
  });

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
