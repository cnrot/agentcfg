import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { getLog } from './core/log.js';
import { detectAgents } from './install.js';

/**
 * 恢复入口（对话式交互，输出恢复指引给 LLM/Skill 使用）
 * @param {string} [targetFile] - 可选：要恢复的文件路径
 */
export default async function recover(targetFile) {
  const agents = detectAgents();
  if (agents.length === 0) {
    console.log('❌ 未检测到支持的 AI 工具，请先执行 config-mgr init');
    return;
  }
  // 默认使用第一个检测到的 agent 目录
  const gitDir = agents[0].dir;

  if (!existsSync(join(gitDir, '.git'))) {
    console.log(`❌ ${gitDir} 目录未初始化 git 仓库`);
    console.log('   请先执行 config-mgr init');
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
    console.log(`   "用 config-mgr 比对后选择性恢复"`);

  } else {
    // 无参数时显示通用指引
    console.log('📖 config-mgr 恢复指引\n');

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
