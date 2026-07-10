import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

/**
 * 在目标目录检测未提交变更并自动提交
 * @param {object} opts
 * @param {string} opts.cwd - 工作目录（有 .git 的目录）
 * @param {string} [opts.source='hook'] - 触发来源 (pre_tool, pre_shell, post_edit)
 * @param {string} [opts.toolName='unknown'] - 触发工具名
 * @returns {{ committed: boolean, message: string }}
 */
export function commit({ cwd, source = 'hook', toolName = 'unknown' }) {
  if (!existsSync(cwd)) {
    return { committed: false, message: `目录不存在: ${cwd}` };
  }
  if (!existsSync(join(cwd, '.git'))) {
    return { committed: false, message: '不是 git 仓库，跳过提交' };
  }
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd, encoding: 'utf-8',
    }).trim();
    if (!status) {
      return { committed: false, message: '无未提交变更，跳过' };
    }
    // 先校验 settings.json 合法性，防止损坏的 JSON 被暂存
    const settingsPath = join(cwd, 'settings.json');
    if (existsSync(settingsPath)) {
      try {
        JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch {
        return { committed: false, message: 'settings.json 格式错误，跳过提交' };
      }
    }
    // git status --porcelain 有输出说明存在已追踪文件的变更或未追踪文件
    // gitignore 排除的文件不会出现在 status 输出中
    execFileSync('git', ['add', '.'], { cwd, encoding: 'utf-8' });
    const gitDate = new Date().toISOString();
    const message = `auto: [${source}] snapshot before ${toolName} at ${gitDate.replace('T', ' ').slice(0, 19)}`;
    execFileSync('git', [
      '-c', 'user.name=agentcfg',
      '-c', 'user.email=agentcfg@local',
      'commit', '--no-verify', '--no-gpg-sign', '-m', message,
    ], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, GIT_COMMITTER_DATE: gitDate, GIT_AUTHOR_DATE: gitDate },
    });
    return { committed: true, message };
  } catch (err) {
    return { committed: false, message: `git 操作失败: ${err.message}` };
  }
}

// CLI 入口：当被 hooks 直接调用时解析 argv 并执行
// 用 import.meta.url 与 process.argv[1] 比较（兼容符号链接、Windows 路径变体）
const argvFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (argvFile && argvFile === import.meta.url) {
  // cwd 默认 process.cwd()，但 hook 上下文不可靠
  // 推荐通过 --dir 显式传入 agent 配置目录（如 ~/.claude）
  let cwd = process.cwd();
  let source = 'hook';
  let toolName = 'unknown';
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--source') source = process.argv[++i] || source;
    if (process.argv[i] === '--tool') toolName = process.argv[++i] || toolName;
    if (process.argv[i] === '--dir') cwd = process.argv[++i] || cwd;
  }
  const result = commit({ cwd, source, toolName });
  console.log(result.message);
  process.exit(0);
}
