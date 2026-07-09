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
    // 解析 --days N 参数
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
};

if (commands[command]) {
  commands[command]().catch(err => {
    console.error('agentcfg 错误:', err.message);
    process.exit(1);
  });
} else {
  console.log('用法: agentcfg <init|uninstall|recover|squash>');
  console.log('  init                安装 agentcfg 到当前 AI 工具环境');
  console.log('  uninstall           卸载 agentcfg');
  console.log('  recover             查看历史或恢复配置（对话式引导）');
  console.log('  squash [--days N]   压缩 N 天前的历史（默认 90 天）');
}
