#!/usr/bin/env node

const [,, command, ...args] = process.argv;

const commands = {
  init: async () => {
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit init');
      console.log('  安装 agents-cfgit 到当前 AI 工具环境');
      return;
    }
    const { default: install } = await import('../src/install.js');
    await install();
  },
  uninstall: async () => {
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit uninstall');
      console.log('  卸载 agents-cfgit，清理 hooks、SKILL.md、备份文件');
      return;
    }
    const { default: uninstall } = await import('../src/uninstall.js');
    await uninstall();
  },
  recover: async () => {
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit recover [<file>] [<commit-hash>]');
      console.log('  无参数          显示恢复指引与最近 15 条历史');
      console.log('  <file>          查看指定文件的修改历史（最近 15 条）');
      console.log('  <file> <hash>   生成三段式比对报告');
      return;
    }
    const { default: recover } = await import('../src/recover.js');
    await recover(args[0], args[1]);
  },
  squash: async () => {
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit squash [--days N] [--force]');
      console.log('  --days N   压缩 N 天前的 commit（默认 90）');
      console.log('  --force    自动暂存未提交变更，完成后恢复');
      return;
    }
    const { squashOldHistory } = await import('../src/core/squash.js');
    const { detectAgents } = await import('../src/install.js');
    const { execFileSync } = await import('child_process');
    let daysThreshold = 90;
    let force = false;
    let invalidArgs = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--days') {
        if (i + 1 >= args.length) { invalidArgs = true; continue; }
        const v = parseInt(args[++i], 10);
        if (Number.isFinite(v) && v > 0) daysThreshold = v;
        else invalidArgs = true;
      } else if (args[i] === '--force') {
        force = true;
      }
    }
    if (invalidArgs) {
      console.log('❌ 参数错误: --days 需要一个正整数');
      console.log('   用法: agents-cfgit squash [--days N] [--force]');
      return;
    }
    const agents = detectAgents();
    if (agents.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具，请先执行 agents-cfgit init');
      return;
    }
    for (const agent of agents) {
      let stashed = false;
      try {
        if (force) {
          const s = execFileSync('git', ['status', '--porcelain'], { cwd: agent.dir, encoding: 'utf-8' }).trim();
          if (s) {
            execFileSync('git', ['stash', 'push', '--include-untracked', '-m', 'agents-cfgit-auto-stash'], { cwd: agent.dir });
            stashed = true;
          }
        }
        const result = squashOldHistory({ cwd: agent.dir, daysThreshold });
        console.log(`  ${agent.type} (${agent.dir}): ${result.message}`);
      } finally {
        if (stashed) execFileSync('git', ['stash', 'pop'], { cwd: agent.dir, stdio: 'pipe' });
      }
    }
  },
  verify: async () => {
    const { verifyAll, previewUninstall } = await import('../src/verify.js');
    const isUninstallDryRun = args.includes('--uninstall');

    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit verify [--uninstall]');
      console.log('  --uninstall  预览卸载影响（dry-run）');
      return;
    }

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
          console.log('  (无操作 — 该 agent 未安装 agents-cfgit)');
        } else {
          for (const act of a.dirActions) {
            console.log(`  • ${act}`);
          }
        }
      }
      console.log('\n💡 确认无误后运行 `agents-cfgit uninstall` 实际执行');
      console.log('⚠️  Claude Code/Cursor 用户需重启 AI 工具会话使卸载生效');
      return;
    }

    const { results, allOk } = verifyAll();
    if (results.length === 0) {
      console.log('❌ 未检测到支持的 AI 工具，请先执行 agents-cfgit init');
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
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit log [<file>] [--count N] [--since <date>]');
      console.log('  <file>        查看指定文件的历史');
      console.log('  --count N     显示 N 条记录（默认 10）');
      console.log('  --since <date> 从指定日期开始（格式: YYYY-MM-DD）');
      return;
    }
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
    if (args.includes('--help') || args.includes('-h') || args.length < 2) {
      console.log('用法: agents-cfgit diff <file> <commit-hash>');
      console.log('  生成指定文件在某 commit 与当前版本的三段式比对报告');
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
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit status');
      console.log('  显示各 agent 工作区状态，包括未追踪和已修改文件');
      return;
    }
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
          console.log('  ?? = 新文件/未追踪    M = 已修改    A = 新增    D = 删除');
          console.log(out);
        }
      } catch (err) {
        console.log(`  ❌ ${err.message}`);
      }
    }
  },
  ui: async () => {
    if (args.includes('--help') || args.includes('-h')) {
      console.log('用法: agents-cfgit ui [--port N] [--host H] [--open] [--kill] [--stop]');
      console.log('  --port N     监听端口（默认 3000）');
      console.log('  --host H     监听地址（默认 127.0.0.1；局域网访问用 0.0.0.0）');
      console.log('  --open       启动后自动调用系统默认浏览器');
      console.log('  --kill       启动前自动释放端口');
      console.log('  --stop       关闭端口上的 WebUI 实例');
      return;
    }
    const { default: server } = await import('../src/ui/server.js');
    await server.start(args);
  },
};

if (command === '--help' || command === '-h' || !command) {
  printHelp();
} else if (commands[command]) {
  commands[command]().catch(err => {
    console.error('agents-cfgit 错误:', err.message);
    process.exit(1);
  });
} else {
  console.log(`未知命令: "${command}"\n`);
  printHelp();
}

function printHelp() {
  console.log('用法: agents-cfgit <命令> [选项]');
  console.log('');
  console.log('命令:');
  console.log('  init                      安装 agents-cfgit 到当前 AI 工具环境');
  console.log('  uninstall                 卸载 agents-cfgit');
  console.log('  recover [<file>] [<hash>] 查看历史或恢复配置（对话式引导）');
  console.log('  squash [--days N] [--force]  压缩 N 天前的历史（默认 90 天）');
  console.log('  verify [--uninstall]      一键验证；加 --uninstall 预览卸载');
  console.log('  log [<file>] [--count N]  查看历史（默认最近 10 条）');
  console.log('  diff <file> <hash>        生成三段式比对报告');
  console.log('  status                    查看各 agent 工作区状态');
  console.log('  ui [--port N] [--host H] [--open] [--kill] [--stop]  启动 WebUI 仪表板（默认 127.0.0.1:3000）');
  console.log('');
  console.log('示例:');
  console.log('  agents-cfgit verify --uninstall   预览卸载影响');
  console.log('  agents-cfgit squash --days 30     压缩 30 天前的 commit');
  console.log('  agents-cfgit squash --days 30 --force  强制压缩（自动暂存变更）');
  console.log('  agents-cfgit log --count 20       显示最近 20 条记录');
  console.log('  agents-cfgit log --since 2026-01-01  从 2026 年开始显示');
  console.log('  agents-cfgit diff CLAUDE.md a1b2c3d  比对文件历史版本');
  console.log('  agents-cfgit ui                     启动本地 WebUI 仪表板');
}
