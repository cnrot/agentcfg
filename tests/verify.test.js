/**
 * verify.js 测试
 * 验证 install/hook/SKILL.md/commit/.gitignore 的检查逻辑
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { verifyAgent, verifyAll, previewUninstall } from '../src/verify.js';

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
  const tmpDir = mkdtempSync(join(tmpdir(), 'cm-verify-'));
  try {
    fn(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 测试 1: 空目录（未安装）所有检查失败
runTest('空目录所有检查都失败', (tmpDir) => {
  const checks = verifyAgent('claude', tmpDir);
  const okCount = checks.filter(c => c.ok).length;
  assert(checks.length === 5, `应有 5 项检查（实际 ${checks.length}）`);
  assert(okCount === 0, `空目录应全部失败（实际通过 ${okCount}）`);
});

// 测试 2: 完整安装（git init + commit + .gitignore + settings.json hook + SKILL.md）
runTest('完整安装全部通过', (tmpDir) => {
  // 模拟 initGit
  execFileSync('git', ['init'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: tmpDir });
  writeFileSync(join(tmpDir, '.gitignore'), 'backups/\n', 'utf-8');
  writeFileSync(join(tmpDir, 'test.txt'), 'init', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: tmpDir });
  execFileSync('git', ['commit', '-m', 'init: 初始配置快照'], { cwd: tmpDir });

  // 模拟 Claude hook 注册
  const settings = {
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'agentcfg commit --source pre_tool' }],
      }],
    },
  };
  writeFileSync(join(tmpDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8');

  // 模拟 SKILL.md 安装
  mkdirSync(join(tmpDir, 'skills/agentcfg'), { recursive: true });
  writeFileSync(join(tmpDir, 'skills/agentcfg/SKILL.md'), '# test', 'utf-8');

  const checks = verifyAgent('claude', tmpDir);
  const okCount = checks.filter(c => c.ok).length;
  checks.forEach(c => {
    if (!c.ok) console.log(`  [debug] 失败项: ${c.label} — ${c.detail}`);
  });
  assert(okCount === 5, `完整安装应全部通过（实际 ${okCount}/5）`);
});

// 测试 3: 有 .git 但无 commit
runTest('.git 存在但无 commit', (tmpDir) => {
  execFileSync('git', ['init'], { cwd: tmpDir });
  const checks = verifyAgent('claude', tmpDir);
  const commitCheck = checks.find(c => c.label.includes('commit'));
  assert(commitCheck && !commitCheck.ok, 'commit 检查应失败');
});

// 测试 4: cursor 适配器识别 hooks.json
runTest('cursor 验证 hooks.json', (tmpDir) => {
  execFileSync('git', ['init'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: tmpDir });
  writeFileSync(join(tmpDir, '.gitignore'), '', 'utf-8');
  writeFileSync(join(tmpDir, 'file.txt'), 'x', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: tmpDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });
  const hooks = {
    version: 1,
    hooks: {
      beforeShellExecution: [{ command: 'agentcfg commit --source pre_shell' }],
    },
  };
  writeFileSync(join(tmpDir, 'hooks.json'), JSON.stringify(hooks, null, 2), 'utf-8');
  mkdirSync(join(tmpDir, 'skills/agentcfg'), { recursive: true });
  writeFileSync(join(tmpDir, 'skills/agentcfg/SKILL.md'), '# test', 'utf-8');

  const checks = verifyAgent('cursor', tmpDir);
  const okCount = checks.filter(c => c.ok).length;
  assert(okCount >= 4, `cursor 完整安装应至少 4 项通过（实际 ${okCount}/5）`);
});

// 测试 5: codex 需 hook + feature flag 同时满足
runTest('codex 需 hook 和 feature flag 都注册', (tmpDir) => {
  execFileSync('git', ['init'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: tmpDir });
  writeFileSync(join(tmpDir, '.gitignore'), '', 'utf-8');
  writeFileSync(join(tmpDir, 'file.txt'), 'x', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: tmpDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });
  // 只注册 hook，不开 feature flag
  const hooks = { hooks: { PreToolUse: [{ hooks: [{ command: 'agentcfg commit' }] }] } };
  writeFileSync(join(tmpDir, 'hooks.json'), JSON.stringify(hooks), 'utf-8');
  writeFileSync(join(tmpDir, 'config.toml'), '[features]\nhooks = false\n', 'utf-8');
  mkdirSync(join(tmpDir, 'skills/agentcfg'), { recursive: true });
  writeFileSync(join(tmpDir, 'skills/agentcfg/SKILL.md'), '# test', 'utf-8');

  const checks = verifyAgent('codex', tmpDir);
  const featureCheck = checks.find(c => c.label.includes('feature'));
  assert(featureCheck && !featureCheck.ok, 'feature flag 关闭时该项应失败');
});

// 测试 6: verifyAll 在无 agent 时返回空
runTest('verifyAll 在无 agent 环境返回空 results', () => {
  // 用一个临时 HOME 避免影响真实环境
  const fakeHome = mkdtempSync(join(tmpdir(), 'fake-home-'));
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  try {
    const { results, allOk } = verifyAll();
    assert(Array.isArray(results), 'results 应为数组');
    assert(results.length === 0, '无 agent 时 results 应为空');
    assert(allOk === false, '无 agent 时 allOk 应为 false');
  } finally {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origProfile;
    rmSync(fakeHome, { recursive: true, force: true });
  }
});

// ─── previewUninstall 测试 ──────────────────────────────

// 测试 7: previewUninstall 返回 actions 数组
runTest('previewUninstall 返回 actions 数组', () => {
  const fakeHome = mkdtempSync(join(tmpdir(), 'fake-home-'));
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  try {
    const { agents, actions } = previewUninstall();
    assert(Array.isArray(agents), 'agents 应为数组');
    assert(Array.isArray(actions), 'actions 应为数组');
    assert(agents.length === actions.length, 'agents 和 actions 长度应一致');
  } finally {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origProfile;
    rmSync(fakeHome, { recursive: true, force: true });
  }
});

// 测试 8: previewUninstall 在已安装环境能识别 hook / skill / meta
runTest('previewUninstall 能识别已安装项', (tmpDir) => {
  // mock 一个完整的 claude 目录（.claude 自身是 git 仓库）
  const claudeDir = join(tmpDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: claudeDir });
  execFileSync('git', ['config', 'user.email', 't@t.com'], { cwd: claudeDir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: claudeDir });
  writeFileSync(join(claudeDir, '.gitignore'), '', 'utf-8');
  writeFileSync(join(claudeDir, 'test.txt'), 'x', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: claudeDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: claudeDir });

  const settings = {
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'agentcfg commit --source pre_tool' }],
      }],
    },
    enabledPlugins: { 'agentcfg@local': true, 'other-plugin@x': true },
  };
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8');
  mkdirSync(join(claudeDir, 'skills/agentcfg'), { recursive: true });
  writeFileSync(join(claudeDir, 'skills/agentcfg/SKILL.md'), '# test', 'utf-8');

  // 指向 fake home
  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  process.env.HOME = tmpDir;
  process.env.USERPROFILE = tmpDir;

  try {
    const { actions } = previewUninstall();
    assert(actions.length >= 1, '应至少检测到 1 个 agent');
    const claudeAction = actions.find(a => a.agent.type === 'claude');
    assert(claudeAction !== undefined, '应检测到 claude agent');
    const allActions = claudeAction.dirActions.join(' | ');
    assert(allActions.includes('hook'), '应包含 hook 清理动作');
    assert(allActions.includes('enabledPlugins'), '应包含 enabledPlugins 清理动作');
    assert(allActions.includes('SKILL.md'), '应包含 SKILL.md 删除动作');
    assert(allActions.includes('.git'), '应说明保留 .git');
  } finally {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origProfile;
  }
});

// 测试 9: previewUninstall 对未安装 agent 返回空操作
runTest('previewUninstall 对未安装 agent 返回空操作', (tmpDir) => {
  // 创建空 claude 目录（无 hook / 无 skill / 无 .git）
  const claudeDir = join(tmpDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  const origHome = process.env.HOME;
  const origProfile = process.env.USERPROFILE;
  process.env.HOME = tmpDir;
  process.env.USERPROFILE = tmpDir;

  try {
    const { actions } = previewUninstall();
    const claudeAction = actions.find(a => a.agent.type === 'claude');
    if (claudeAction) {
      // 无 hook / 无 skill / 无 .git：应只显示 .git 保留（如果有）或其他空操作
      const hasHookAction = claudeAction.dirActions.some(a => a.includes('hook'));
      assert(!hasHookAction, '无 hook 时不应有 hook 清理动作');
    }
  } finally {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origProfile;
  }
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
