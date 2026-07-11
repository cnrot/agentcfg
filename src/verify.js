import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectAgents } from './install.js';

/**
 * 验证指定目录的 agentcfg 安装是否完整
 * @param {string} agentType - claude / cursor / codex / opencode
 * @param {string} agentDir - 配置目录绝对路径
 * @returns {Array<{label: string, ok: boolean, detail: string}>}
 */
export function verifyAgent(agentType, agentDir) {
  const checks = [];

  // 1. .git 存在
  const gitDir = join(agentDir, '.git');
  checks.push({
    label: `${agentType}: .git 仓库`,
    ok: existsSync(gitDir),
    detail: existsSync(gitDir) ? gitDir : '未找到',
  });

  // 2. .gitignore 存在
  const gitignorePath = join(agentDir, '.gitignore');
  checks.push({
    label: `${agentType}: .gitignore`,
    ok: existsSync(gitignorePath),
    detail: existsSync(gitignorePath) ? gitignorePath : '未找到',
  });

  // 3. 至少 1 个 commit
  let commitCount = 0;
  let firstCommitMsg = '';
  if (existsSync(gitDir)) {
    try {
      const out = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: agentDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      commitCount = parseInt(out, 10) || 0;
      if (commitCount > 0) {
        firstCommitMsg = execFileSync('git', ['log', '--format=%s', '-1'], {
          cwd: agentDir, encoding: 'utf-8',
        }).trim();
      }
    } catch { /* 非 git 仓库 */ }
  }
  checks.push({
    label: `${agentType}: 至少 1 个 commit`,
    ok: commitCount > 0,
    detail: commitCount > 0
      ? `${commitCount} 个 commit（最新: ${firstCommitMsg}）`
      : '无 commit',
  });

  // 4. hooks 注册（按 agent 类型检查）
  const hookCheck = checkHookRegistration(agentType, agentDir);
  checks.push(hookCheck);

  // 5. SKILL.md 安装
  const skillPath = join(agentDir, 'skills/agentcfg/SKILL.md');
  // OpenCode 的 SKILL.md 安装路径与其他不同（实际由 install.js 走同逻辑）
  const skillOk = existsSync(skillPath);
  checks.push({
    label: `${agentType}: SKILL.md`,
    ok: skillOk,
    detail: skillOk ? skillPath : '未安装',
  });

  return checks;
}

/**
 * 检查 hook 注册情况
 */
function checkHookRegistration(agentType, agentDir) {
  const label = `${agentType}: hook 注册`;
  try {
    if (agentType === 'claude') {
      const settings = JSON.parse(readFileSync(join(agentDir, 'settings.json'), 'utf-8'));
      const hasHook = settings.hooks?.PreToolUse?.some(h =>
        h.hooks?.some(hk => hk.command?.includes('commit.js') || hk.command?.includes('agentcfg commit'))
      );
      return { label, ok: !!hasHook, detail: hasHook ? '已注册' : '未注册' };
    }
    if (agentType === 'cursor') {
      const hooks = JSON.parse(readFileSync(join(agentDir, 'hooks.json'), 'utf-8'));
      const hasHook = hooks.hooks?.beforeShellExecution?.some(h => h.command?.includes('commit.js'))
        || hooks.hooks?.afterFileEdit?.some(h => h.command?.includes('commit.js'));
      return { label, ok: !!hasHook, detail: hasHook ? '已注册' : '未注册' };
    }
    if (agentType === 'codex') {
      const hooks = JSON.parse(readFileSync(join(agentDir, 'hooks.json'), 'utf-8'));
      const hasHook = hooks.hooks?.PreToolUse?.some(e =>
        e.command?.includes('commit.js')
      );
      let featureOk = false;
      try {
        const toml = readFileSync(join(agentDir, 'config.toml'), 'utf-8');
        featureOk = /^\[features\]\s*$/m.test(toml) && /^codex_hooks\s*=\s*true\s*$/m.test(toml);
      } catch { /* */ }
      return {
        label: `${agentType}: hook + feature flag`,
        ok: !!hasHook && featureOk,
        detail: `hook=${hasHook ? '✓' : '✗'} feature=${featureOk ? '✓' : '✗'}`,
      };
    }
    if (agentType === 'opencode') {
      const pluginPath = join(agentDir, 'plugins/agentcfg.ts');
      return {
        label,
        ok: existsSync(pluginPath),
        detail: existsSync(pluginPath) ? pluginPath : '插件文件未找到',
      };
    }
  } catch (err) {
    return { label, ok: false, detail: `检查失败: ${err.message}` };
  }
  return { label, ok: false, detail: '未知 agent 类型' };
}

/**
 * 验证所有检测到的 agent 安装
 * @returns {{ agents: Array, allOk: boolean }}
 */
export function verifyAll() {
  const agents = detectAgents();
  const results = agents.map(a => ({
    agent: a,
    checks: verifyAgent(a.type, a.dir),
  }));
  const allOk = results.length > 0 && results.every(r => r.checks.every(c => c.ok));
  return { agents, results, allOk };
}

/**
 * 模拟卸载：列出每个 agent 将被清理的文件/配置项（不实际修改）
 * @returns {{ agents: Array, actions: Array }}
 */
export function previewUninstall() {
  const agents = detectAgents();
  const actions = [];

  for (const agent of agents) {
    const dir = agent.dir;
    const dirActions = [];

    // 检查 hook 注册情况
    const hookCheck = checkHookRegistration(agent.type, dir);
    if (hookCheck.ok) {
      dirActions.push(`从 ${agent.type} 配置中移除 agentcfg hook`);
    }

    // 检查 enabledPlugins（仅 claude）
    if (agent.type === 'claude') {
      const settingsPath = join(dir, 'settings.json');
      if (existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
          if (settings.enabledPlugins && Object.keys(settings.enabledPlugins).length > 0) {
            const matched = Object.keys(settings.enabledPlugins).filter(k =>
              k.toLowerCase().includes('agentcfg')
            );
            if (matched.length > 0) {
              dirActions.push(`从 enabledPlugins 移除: ${matched.join(', ')}`);
            }
          }
        } catch { /* 损坏 JSON，跳过 */ }
      }
    }

    // Codex 还原 config.toml hooks 值
    if (agent.type === 'codex') {
      const metaPath = join(dir, 'config.toml.agentcfg-meta');
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          if (meta.originalHooksValue === null) {
            dirActions.push('从 config.toml 移除 agentcfg 添加的 [features] 段');
          } else {
            dirActions.push(`还原 config.toml codex_hooks = ${meta.originalHooksValue}`);
          }
          dirActions.push('删除元数据文件 config.toml.agentcfg-meta');
        } catch { /* */ }
      }
    }

    // SKILL.md
    const skillPath = join(dir, 'skills/agentcfg/SKILL.md');
    if (existsSync(skillPath)) {
      dirActions.push(`删除 ${skillPath}`);
    }

    // 备份文件保留
    const backupFiles = [];
    const candidates = [
      'settings.json.bak.agentcfg',
      'hooks.json.bak.agentcfg',
      'config.toml.bak.agentcfg',
    ];
    for (const name of candidates) {
      if (existsSync(join(dir, name))) backupFiles.push(name);
    }
    if (backupFiles.length > 0) {
      dirActions.push(`保留备份文件: ${backupFiles.join(', ')}（不会自动删除）`);
    }

    // .git 目录
    if (existsSync(join(dir, '.git'))) {
      dirActions.push(`保留 .git 目录（不主动删除，含所有备份历史）`);
    }

    // OpenCode plugin
    if (agent.type === 'opencode') {
      const pluginPath = join(dir, 'plugins/agentcfg.ts');
      if (existsSync(pluginPath)) {
        dirActions.push(`删除 OpenCode 插件文件 ${pluginPath}`);
      }
    }

    actions.push({ agent, dirActions });
  }

  return { agents, actions };
}

