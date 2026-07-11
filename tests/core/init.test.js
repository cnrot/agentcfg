/**
 * init.js 测试
 * 用临时目录模拟场景验证 initGit 逻辑
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { initGit } from '../../src/core/init.js';

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

// 测试1: 首次初始化成功
runTest('首次初始化成功', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  writeFileSync(join(repoDir, 'test.txt'), 'hello');

  const result = initGit(repoDir);

  assert(result.initialized === true, 'initialized 应为 true');
  assert(result.skipped === false, 'skipped 应为 false');
  assert(result.message === 'git 仓库初始化完成', 'message 应正确');
  assert(existsSync(join(repoDir, '.git')), '.git 目录已创建');
  assert(existsSync(join(repoDir, '.gitignore')), '.gitignore 文件已创建');

  // 验证首次 commit 存在
  const log = execFileSync('git', ['log', '--oneline'], { cwd: repoDir, encoding: 'utf-8' }).trim();
  assert(log.length > 0, '存在提交记录');
  assert(log.includes('初始配置快照'), '提交消息正确');
});

// 测试2: 重复初始化幂等（已存在 .git 时跳过）
runTest('重复初始化幂等', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  writeFileSync(join(repoDir, 'test.txt'), 'hello');

  // 第一次初始化
  const first = initGit(repoDir);
  assert(first.initialized === true, '首次初始化成功');

  // 第二次初始化
  const second = initGit(repoDir);
  assert(second.initialized === false, '第二次 initialized 应为 false');
  assert(second.skipped === true, '第二次 skipped 应为 true');
  assert(second.message === 'git 仓库已存在', '第二次 message 应提示已存在');

  // .git 和 .gitignore 仍然存在
  assert(existsSync(join(repoDir, '.git')), '.git 目录仍然存在');
  assert(existsSync(join(repoDir, '.gitignore')), '.gitignore 文件仍然存在');
});

// 测试3: .gitignore 内容与模板一致
runTest('.gitignore 内容正确', (tmpDir) => {
  const repoDir = join(tmpDir, 'repo');
  mkdirSync(repoDir, { recursive: true });
  writeFileSync(join(repoDir, 'test.txt'), 'hello');
  initGit(repoDir);

  const gitignoreContent = readFileSync(join(repoDir, '.gitignore'), 'utf-8');
  const realTemplatePath = new URL('../../templates/gitignore', import.meta.url);
  const realTemplate = readFileSync(realTemplatePath, 'utf-8');
  assert(gitignoreContent === realTemplate, '.gitignore 内容应与模板完全一致');
});

// 测试4: 目录中无文件时也能初始化
runTest('空目录也能初始化', (tmpDir) => {
  const repoDir = join(tmpDir, 'empty-repo');
  mkdirSync(repoDir, { recursive: true });

  const result = initGit(repoDir);
  assert(result.initialized === true, '空目录初始化成功');
  assert(existsSync(join(repoDir, '.git')), '.git 目录已创建');
});

// 测试5: 初始化失败时不抛异常（如 git 命令出错）
runTest('失败时不抛异常', (tmpDir) => {
  const repoDir = join(tmpDir, 'fail-repo');
  mkdirSync(repoDir, { recursive: true });
  // 不设置 git 用户配置，让 commit 可能失败
  // 但 git init 会成功，所以返回结构仍然完整
  let threw = false;
  let result;
  try {
    result = initGit(repoDir);
  } catch (e) {
    threw = true;
  }
  assert(threw === false, '不应抛出异常');
  // 可能因全局 git 配置缺失导致 commit 失败，但返回值结构应当有效
  assert(result !== undefined, '应返回结果对象');
  assert(typeof result.initialized === 'boolean', '应返回 initialized 布尔值');
  assert(typeof result.skipped === 'boolean', '应返回 skipped 布尔值');
  assert(typeof result.message === 'string', '应返回 message 字符串');
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
