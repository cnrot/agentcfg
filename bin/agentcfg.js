#!/usr/bin/env node

const [,, command, ...args] = process.argv;

const commands = {
  init: async () => {
    const { default: install } = await import('../src/install.js');
    await install();
  },
  uninstall: async () => {
    const { default: uninstall } = await import('../src/uninstall.js');
    await uninstall();
  },
  recover: async () => {
    const { default: recover } = await import('../src/recover.js');
    await recover(args[0], args[1]);
  },
  squash: async () => {
    const { squashOldHistory } = await import('../src/core/squash.js');
    const { detectAgents } = await import('../src/install.js');
    let daysThreshold = 90;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--days') {
        const v = parseInt(args[++i], 10);
        if (Number.isFinite(v) && v > 0) daysThreshold = v;
      }
    }
    const agents = detectAgents();
    if (agents.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具，请先执行 agentcfg init');
      return;
    }
    for (const agent of agents) {
      const result = squashOldHistory({ cwd: agent.dir, daysThreshold });
      console.log(`  ${agent.type} (${agent.dir}): ${result.message}`);
    }
  },
  verify: async () => {
    const { verifyAll, previewUninstall } = await import('../src/verify.js');
    const isUninstallDryRun = args.includes('--uninstall');

    if (isUninstallDryRun) {
      const { agents, actions } = previewUninstall();
      if (agents.length === 0) {
        console.log('❌ 未检测到支持的 AI 工具，无需卸载');
        return;
      }
      console.log('🔍 卸载预览（dry-run，不会实际修改任何文件）\n');
      for (const a of actions) {
        console.log(`${a.agent.type} (${a.agent.dir}):`);
        if (a.dirActions.length === 0) {
          console.log('  (无操作 — 该 agent 未安装 agentcfg)');
        } else {
          for (const act of a.dirActions) {
            console.log(`  • ${act}`);
          }
        }
      }
      console.log('\n💡 确认无误后运行 `agentcfg uninstall` 实际执行');
      console.log('⚠️  Claude Code/Cursor 用户需重启 AI 工具会话使卸载生效');
      return;
    }

    const { results, allOk } = verifyAll();
    if (results.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具，请先执行 agentcfg init');
      process.exit(1);
    }
    let failCount = 0;
    for (const r of results) {
      console.log(`\n${r.agent.type} (${r.agent.dir}):`);
      for (const c of r.checks) {
        const mark = c.ok ? '✅' : '❌';
        console.log(`  ${mark} ${c.label} — ${c.detail}`);
        if (!c.ok) failCount++;
      }
    }
    console.log('');
    if (allOk) {
      console.log('✅ 全部检查通过');
    } else {
      console.log(`❌ ${failCount} 项检查未通过`);
      process.exit(1);
    }
  },
  log: async () => {
    const { getLog } = await import('../src/core/log.js');
    const { detectAgents } = await import('../src/install.js');
    // 先从 args 中抽出 --count N 和 --since X，再从剩余取 filePath
    let count = 10;
    let since = null;
    const remaining = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--count' && i + 1 < args.length) {
        const v = parseInt(args[i + 1], 10);
        if (Number.isFinite(v) && v > 0) count = v;
        i++;
      } else if (args[i] === '--since' && i + 1 < args.length) {
        since = args[i + 1];
        i++;
      } else {
        remaining.push(args[i]);
      }
    }
    const filePath = remaining[0] || null;
    const agents = detectAgents();
    if (agents.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具');
      return;
    }
    const entries = getLog({ cwd: agents[0].dir, filePath, count, since });
    if (entries.length === 0) {
      console.log(`⚠️  ${filePath ? `文件 "${filePath}" ` : ''}没有历史记录`);
      return;
    }
    const scope = filePath ? ` "${filePath}" ` : ' ';
    console.log(`📜${scope}历史（最近 ${entries.length} 条）:\n`);
    entries.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.hash}] ${e.date}`);
      console.log(`     ${e.message}`);
    });
  },
  diff: async () => {
    const { generateDiffReport } = await import('../src/core/diff.js');
    const { detectAgents } = await import('../src/install.js');
    if (args.length < 2) {
      console.log('用法: agentcfg diff <file> <commit-hash>');
      return;
    }
    const [filePath, commitHash] = args;
    const agents = detectAgents();
    if (agents.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具');
      return;
    }
    console.log(generateDiffReport({ cwd: agents[0].dir, hash: commitHash, filePath }));
  },
  status: async () => {
    const { execFileSync } = await import('child_process');
    const { detectAgents } = await import('../src/install.js');
    const agents = detectAgents();
    if (agents.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具');
      return;
    }
    for (const agent of agents) {
      console.log(`\n${agent.type} (${agent.dir}):`);
      try {
        const out = execFileSync('git', ['status', '--short', '--branch'], {
          cwd: agent.dir, encoding: 'utf-8',
        }).trim();
        if (!out) {
          const ahead = execFileSync('git', ['log', '--oneline', '-1'], {
            cwd: agent.dir, encoding: 'utf-8',
          }).trim();
          console.log(`  ✅ 工作区干净（最新: ${ahead || '无 commit'}）`);
        } else {
          console.log(out);
        }
      } catch (err) {
        console.log(`  ❌ ${err.message}`);
      }
    }
  },
};

if (commands[command]) {
  commands[command]().catch(err => {
    console.error('agentcfg 错误:', err.message);
    process.exit(1);
  });
} else {
  console.log('用法: agentcfg <init|uninstall|recover|squash|verify|log|diff|status>');
  console.log('  init                       安装 agentcfg 到当前 AI 工具环境');
  console.log('  uninstall                  卸载 agentcfg');
  console.log('  recover                    查看历史或恢复配置（对话式引导）');
  console.log('  squash [--days N]          压缩 N 天前的历史（默认 90 天）');
  console.log('  verify [--uninstall]     一键验证；加 --uninstall 预览卸载影响');
  console.log('  log [<file>] [--count N]   查看历史（默认最近 10 条）');
  console.log('  diff <file> <commit-hash>  生成三段式比对报告');
  console.log('  status                     查看各 agent 工作区状态');
}
