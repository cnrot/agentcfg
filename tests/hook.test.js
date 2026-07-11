// agentcfg 核心测试: hook 收到 PreToolUse JSON → 自动 commit
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';

let passed = 0, failed = 0;
function assert(c, l) { c ? (passed++, console.log(`  ok ${l}`)) : (failed++, console.log(`  FAIL ${l}`)); }
function runTest(name, fn) {
  console.log(`\nTest: ${name}`);
  const d = mkdtempSync(join(tmpdir(), 'ac-'));
  try { fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
}

// 触发 hook 脚本（用 import 让 stdin 走 process.stdin）
function triggerHook(cwd, stdin) {
  const hookUrl = pathToFileURL('G:/github/agentcfg/src/hooks/claude.js').href;
  // 写 stdin 到临时文件, 再用 spawnSync 重定向
  const stdinFile = join(tmpdir(), `ac-stdin-${Date.now()}.json`);
  writeFileSync(stdinFile, stdin);
  return execFileSync('node', ['--input-type=module', '-e', `
    import(${JSON.stringify(hookUrl)});
  `], { env: { ...process.env, AGENTCFG_CWD: cwd }, input: stdin, encoding: 'utf-8', timeout: 5000 });
}

runTest('1. hook 在有变更时自动 commit', (cwd) => {
  execFileSync('git', ['init'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  writeFileSync(join(cwd, 'a.txt'), '1');
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['commit', '-m', 'init'], { cwd });

  writeFileSync(join(cwd, 'a.txt'), '2');
  triggerHook(cwd, JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'a.txt' } }));

  const log = execFileSync('git', ['log', '--oneline'], { cwd, encoding: 'utf-8' }).trim();
  assert(log.split('\n').length === 2, `应有 2 个 commit, 实际: ${log}`);
  assert(log.includes('auto: Write'), '第二次 commit 应含 "auto: Write"');
});

runTest('2. 无变更时跳过 commit', (cwd) => {
  execFileSync('git', ['init'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd });
  writeFileSync(join(cwd, 'a.txt'), '1');
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['commit', '-m', 'init'], { cwd });

  triggerHook(cwd, JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'a.txt' } }));

  const log = execFileSync('git', ['log', '--oneline'], { cwd, encoding: 'utf-8' }).trim();
  assert(log.split('\n').length === 1, `应只有 1 个 commit, 实际: ${log}`);
});

runTest('3. 不是 git 仓库时跳过', (cwd) => {
  triggerHook(cwd, JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'a.txt' } }));
  assert(!existsSync(join(cwd, '.git')), 'cwd 仍不应有 .git');
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
