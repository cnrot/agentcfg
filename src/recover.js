import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { getLog } from './core/log.js';
import { generateDiffReport } from './core/diff.js';
import { detectAgents } from './install.js';

/**
 * 校验 commit hash 合法性，避免把任意字符串传给 git show
 * @returns {string|null} 规范化后的完整 hash，无效则返回 null
 */
function resolveCommitHash(cwd, hash) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', hash], {
      cwd, encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 恢复入口（对话式交互，输出恢复指引给 LLM/Skill 使用）
 * @param {string} [targetFile] - 可选：要恢复的文件路径
 * @param {string} [commitHash] - 可选：要查看差异的 commit hash
 */
export default async function recover(targetFile, commitHash) {
  const agents = detectAgents();
  if (agents.length === 0) {
    console.log('❌ 未检测到支持的 AI 工具，请先执行 agentcfg init');
    return;
  }

  // 多 agent 环境下提示用户选择，避免静默选错目录
  let gitDir;
  if (agents.length === 1) {
    gitDir = agents[0].dir;
  } else {
    console.log(`⚠️  检测到 ${agents.length} 个 agent 目录：`);
    agents.forEach((a, i) => console.log(`   [${i}] ${a.type}: ${a.dir}`));
    console.log(`   当前默认使用 [0] ${agents[0].type}\n   暂不支持指定 agent，恢复时将使用该目录的 git 历史\n   如需切换目录，请先 cd 到对应 agent 配置目录再执行\n`);
    gitDir = agents[0].dir;
  }

  if (!existsSync(join(gitDir, '.git'))) {
    console.log(`❌ ${gitDir} 目录未初始化 git 仓库`);
    console.log('   请先执行 agentcfg init');
    return;
  }

  if (targetFile && commitHash) {
    // 校验 commit hash 合法性
    const fullHash = resolveCommitHash(gitDir, commitHash);
    if (!fullHash) {
      console.log(`❌ 无效的 commit hash: "${commitHash}"`);
      console.log('   请先用 `git log` 查找合法的 hash');
      return;
    }
    // 生成三段式比对报告
    console.log(generateDiffReport({ cwd: gitDir, hash: fullHash, filePath: targetFile }));
    return;
  }

  if (targetFile) {
    // 查看指定文件的历史
    const log = getLog({ cwd: gitDir, filePath: targetFile, count: 15 });
    if (log.length === 0) {
      console.log(`⚠️  文件 "${targetFile}" 没有历史记录`);
      return;
    }

    console.log(`📜 "${targetFile}" 的修改历史（最近 ${log.length} 条）:\n`);
    log.forEach((entry, i) => {
      console.log(`  ${i + 1}. [${entry.hash}] ${entry.date}`);
      console.log(`     ${entry.message}`);
    });

    console.log(`\n💡 如需查看某个版本的差异，请告知 LLM：`);
    console.log(`   "帮我看下第 N 个版本改了什么"`);
    console.log(`   "用 agentcfg 比对后选择性恢复"`);

  } else {
    // 无参数时显示通用指引
    console.log('📖 agentcfg 恢复指引\n');

    const log = getLog({ cwd: gitDir, count: 15 });
    if (log.length > 0) {
      console.log(`  最近 ${log.length} 次提交:\n`);
      log.forEach(entry => {
        console.log(`  [${entry.hash}] ${entry.date}`);
        console.log(`  → ${entry.message}`);
        console.log();
      });
    }

    console.log('  常见操作:');
    console.log('  1. 查看某个文件的修改历史');
    console.log('     → "看看 CLAUDE.md 的修改历史"');
    console.log();
    console.log('  2. 恢复特定文件的旧版本');
    console.log('     → "把前天改的 CLAUDE.md 找回来"');
    console.log();
    console.log('  3. 三段式比对恢复（推荐）');
    console.log('     → 查历史 → 比对差异 → 选择性合并');
  }
}
