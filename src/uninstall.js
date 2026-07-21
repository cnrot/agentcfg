import { homedir } from 'os';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { uninstallClaudeHooks } from './hooks/claude.js';
import { uninstallCursorHooks } from './hooks/cursor.js';
import { uninstallCodexHooks } from './hooks/codex.js';
import { uninstallOpencodeHooks } from './hooks/opencode.js';

export default async function uninstall() {
  const home = homedir();
  console.log('Uninstalling agents-cfgit...\n');

  const agents = [
    { name: 'Claude Code', dir: join(home, '.claude'), fn: uninstallClaudeHooks },
    { name: 'Cursor', dir: join(home, '.cursor'), fn: uninstallCursorHooks },
    { name: 'Codex CLI', dir: join(home, '.codex'), fn: uninstallCodexHooks },
  ];

  for (const agent of agents) {
    if (existsSync(agent.dir)) {
      const result = agent.fn(agent.dir);
      console.log(`  ${agent.name}: ${result.message}`);
    }
    // 清理备份文件
    const backupNames = ['settings.json.bak.agents-cfgit', 'hooks.json.bak.agents-cfgit', 'config.toml.bak.agents-cfgit'];
    for (const name of backupNames) {
      const bp = join(agent.dir, name);
      if (existsSync(bp)) {
        rmSync(bp);
        console.log(`  ${agent.name}: 备份文件 ${name} 已清理`);
      }
    }
    // 移除 SKILL.md
    const skillPath = join(agent.dir, 'skills/agents-cfgit/SKILL.md');
    if (existsSync(skillPath)) {
      rmSync(skillPath);
      console.log(`  ${agent.name}: SKILL.md 已移除`);
    }
  }

  // OpenCode is project-local, not in home directory
  const opencodeDir = join(process.cwd(), '.opencode');
  if (existsSync(opencodeDir)) {
    const result = uninstallOpencodeHooks(opencodeDir);
    console.log(`  OpenCode: ${result.message}`);
    // 清理 OpenCode 备份文件
    const opencodeBackup = join(opencodeDir, 'plugin-opencode.ts.bak.agents-cfgit');
    if (existsSync(opencodeBackup)) {
      rmSync(opencodeBackup);
      console.log('  OpenCode: 备份文件 plugin-opencode.ts.bak.agents-cfgit 已清理');
    }
  }

  console.log('  ⚠️  如需删除 .git 仓库（会永久丢失所有备份历史），请手动执行:');
  console.log('    trash ~/.claude/.git');
  console.log('    trash ~/.cursor/.git');
  console.log('    trash ~/.codex/.git');
  console.log('');
  console.log('  ⚠️  如需清理 npm 全局 CLI 包装器残留，请执行:');
  console.log('    npm uninstall -g agents-cfgit');
  console.log('    # 然后手动删除 bin 目录下的 agents-cfgit 包装文件');
  console.log('    trash "$(npm root -g)/../bin/agents-cfgit"');
  console.log('    trash "$(npm root -g)/../bin/agents-cfgit.cmd"');
  console.log('    trash "$(npm root -g)/../bin/agents-cfgit.ps1"');
}
