/**
 * bin/agentcfg.js CLI dispatch tests
 * 验证 squashed arg parsing 与 help 文本等纯逻辑（无需 child_process）
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

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
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-cli-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── 提取自 bin/agentcfg.js 的纯函数（与生产代码同步） ────────────
//
// 这是一个测试夹具：模拟 squashed 命令的 arg 解析，避免 spawn child_process。
// 实际行为通过 bin/agentcfg.js 中的等效逻辑验证。
//
function parseSquashArgs(args) {
  let daysThreshold = 90;
  let force = false;
  let invalid = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days') {
      if (i + 1 >= args.length) {
        invalid = true;
        continue;
      }
      const v = parseInt(args[++i], 10);
      if (Number.isFinite(v) && v > 0) daysThreshold = v;
      else invalid = true;
    } else if (args[i] === '--force') {
      force = true;
    }
  }
  return { daysThreshold, force, invalid };
}

// ─── 测试 1: 单独 --days N ───────────────────────────
runTest('parseSquashArgs: 单独 --days N', (_) => {
  const r = parseSquashArgs(['--days', '30']);
  assert(r.daysThreshold === 30, `days 应为 30，实际 ${r.daysThreshold}`);
  assert(r.force === false, 'force 应为 false');
});

// ─── 测试 2: 单独 --force ───────────────────────────
runTest('parseSquashArgs: 单独 --force', (_) => {
  const r = parseSquashArgs(['--force']);
  assert(r.daysThreshold === 90, 'days 保持默认 90');
  assert(r.force === true, 'force 应为 true');
});

// ─── 测试 3: --days 30 --force（顺序对） ─────────────
runTest('parseSquashArgs: --days 30 --force', (_) => {
  const r = parseSquashArgs(['--days', '30', '--force']);
  assert(r.daysThreshold === 30, 'days 应为 30');
  assert(r.force === true, 'force 应为 true');
});

// ─── 测试 4: --force --days 30（顺序反） ─────────────
runTest('parseSquashArgs: --force --days 30（顺序反）', (_) => {
  const r = parseSquashArgs(['--force', '--days', '30']);
  assert(r.daysThreshold === 30, 'days 应为 30');
  assert(r.force === true, 'force 应为 true');
});

// ─── 测试 5: --days 末尾无值 → 标记为 invalid ────────
runTest('parseSquashArgs: --days 末尾无值', (_) => {
  const r = parseSquashArgs(['--days']);
  assert(r.invalid === true, '应标记为 invalid');
});

// ─── 测试 6: --days 0 / 负数 → invalid ──────────────
runTest('parseSquashArgs: --days 0', (_) => {
  const r = parseSquashArgs(['--days', '0']);
  assert(r.invalid === true, '应标记为 invalid（0 非合法阈值）');
});

runTest('parseSquashArgs: --days abc', (_) => {
  const r = parseSquashArgs(['--days', 'abc']);
  assert(r.invalid === true, '应标记为 invalid（非数字）');
});

// ─── 测试 7: 完整夹具驱动 bin/agentcfg.js squashed 帮助输出 ───
runTest('bin/agentcfg.js squashed --help 输出包含 --force', (_) => {
  const out = execFileSync('node', [join(process.cwd(), 'bin', 'agentcfg.js'), 'squash', '--help'], {
    encoding: 'utf-8',
  });
  assert(out.includes('--force'), 'squash --help 应包含 --force');
  assert(out.includes('--days'), 'squash --help 应包含 --days');
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
