import { homedir } from 'os';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { uninstallClaudeHooks } from './hooks/claude.js';
import { uninstallCursorHooks } from './hooks/cursor.js';
import { uninstallCodexHooks } from './hooks/codex.js';
import { uninstallOpencodeHooks } from './hooks/opencode.js';

export default async function uninstall() {
  const home = homedir();
  console.log('Uninstalling agentcfg...\n');

  const agents = [
    { name: 'Claude Code', dir: join(home, '.claude'), fn: uninstallClaudeHooks },
    { name: 'Cursor', dir: join(home, '.cursor'), fn: uninstallCursorHooks },
    { name: 'Codex CLI', dir: join(home, '.codex'), fn: uninstallCodexHooks },
  ];

  for (const agent of agents) {
    if (existsSync(agent.dir)) {
      const result = await agent.fn(agent.dir);
      console.log(`  ${agent.name}: ${result.message}`);
    }
    // 移除 SKILL.md
    const skillPath = join(agent.dir, 'skills/agentcfg/SKILL.md');
    if (existsSync(skillPath)) {
      rmSync(skillPath);
      console.log(`  ${agent.name}: SKILL.md 已移除`);
    }
  }

  // OpenCode is project-local, not in home directory
  const opencodeDir = join(process.cwd(), '.opencode');
  if (existsSync(opencodeDir)) {
    const result = await uninstallOpencodeHooks(opencodeDir);
    console.log(`  OpenCode: ${result.message}`);
  }

  console.log('\nWarning: .git repos in agent directories are NOT removed automatically.');
  console.log('  If you want to remove them, run:');
  console.log('    trash ~/.claude/.git');
  console.log('    trash ~/.cursor/.git');
  console.log('    trash ~/.codex/.git');
}
