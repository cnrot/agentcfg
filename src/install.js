import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initGit } from './core/init.js';
import { installClaudeHooks } from './hooks/claude.js';
import { installCursorHooks } from './hooks/cursor.js';
import { installCodexHooks } from './hooks/codex.js';
import { installOpencodeHooks } from './hooks/opencode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT_SCRIPT = join(__dirname, 'core/commit.js');

/** 检测到的 agent 环境 */
export function detectAgents() {
  const home = homedir();
  const agents = [];

  // Claude Code
  const claudeDir = join(home, '.claude');
  if (existsSync(join(claudeDir, 'settings.json'))) {
    agents.push({ type: 'claude', dir: claudeDir });
  }

  // Cursor（用户级）
  const cursorDir = join(home, '.cursor');
  if (existsSync(cursorDir)) {
    agents.push({ type: 'cursor', dir: cursorDir });
  }

  // Codex CLI
  const codexDir = join(home, '.codex');
  if (existsSync(codexDir)) {
    agents.push({ type: 'codex', dir: codexDir });
  }

  // OpenCode（项目级，扫描多个可能位置）
  const possibleOpencodeDirs = [
    '.opencode',
    join(process.cwd(), '.opencode'),
  ];
  for (const dir of possibleOpencodeDirs) {
    if (existsSync(dir)) {
      agents.push({ type: 'opencode', dir: join(dir) });
      break;
    }
  }

  return agents;
}

/**
 * 统一安装入口
 */
export default async function install() {
  console.log('🔍 检测 AI 工具环境...');
  const agents = detectAgents();

  if (agents.length === 0) {
    console.log('❌ 未检测到支持的 AI 工具目录');
    console.log('   支持的工具有: Claude Code, Cursor, Codex CLI, OpenCode');
    return;
  }

  for (const agent of agents) {
    console.log(`\n📦 ${agent.type}: ${agent.dir}`);

    // Step 1: git init（幂等）
    const initResult = initGit(agent.dir);
    if (initResult.initialized) {
      console.log(`   ✅ ${initResult.message}`);
    } else {
      console.log(`   ℹ️  ${initResult.message}`);
    }

    // Step 2: 注册 hooks（幂等）
    let hookResult;
    switch (agent.type) {
      case 'claude':
        hookResult = installClaudeHooks(agent.dir, COMMIT_SCRIPT);
        break;
      case 'cursor':
        hookResult = installCursorHooks(agent.dir, COMMIT_SCRIPT);
        break;
      case 'codex':
        hookResult = installCodexHooks(agent.dir, COMMIT_SCRIPT);
        break;
      case 'opencode':
        hookResult = installOpencodeHooks(agent.dir);
        break;
    }
    if (hookResult?.installed) {
      console.log(`   ✅ ${hookResult.message}`);
    } else if (hookResult) {
      console.log(`   ℹ️  ${hookResult.message}`);
    }

    // Step 3: 安装 SKILL.md
    const skillDir = join(agent.dir, 'skills/agentcfg');
    const skillPath = join(skillDir, 'SKILL.md');
    if (!existsSync(skillPath)) {
      mkdirSync(skillDir, { recursive: true });
      const skillContent = readFileSync(
        join(__dirname, '../SKILL.md'), 'utf-8'
      );
      writeFileSync(skillPath, skillContent, 'utf-8');
      console.log('   ✅ SKILL.md 已安装');
    } else {
      console.log('   ℹ️  SKILL.md 已存在，跳过');
    }
  }

  console.log('\n✅ agentcfg 安装完成！');
  console.log('   SKILL.md 已安装到各技能目录，AI agent 将自动获取操作指引。');
}
