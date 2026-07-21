import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '../../templates');

export function initGit(cwd) {
  if (existsSync(join(cwd, '.git'))) {
    // 已存在 .git 时，检查是否有 commit；没有则继续执行首次提交
    try {
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd, stdio: 'ignore' });
      return { initialized: false, skipped: true, message: 'git 仓库已存在' };
    } catch {
      // .git 存在但无 commit，继续走首次提交流程
    }
  }
  try {
    if (!existsSync(join(cwd, '.git'))) {
      execFileSync('git', ['init'], { cwd });
    }
    const gitignoreSrc = join(TEMPLATE_DIR, 'gitignore');
    if (existsSync(gitignoreSrc)) {
      const content = readFileSync(gitignoreSrc, 'utf-8');
      writeFileSync(join(cwd, '.gitignore'), content, 'utf-8');
    }
    execFileSync('git', ['add', '.'], { cwd });
    // 设置本地 git user 配置，避免无全局配置时 commit 失败
    const gitDate = new Date().toISOString();
    execFileSync('git', [
      '-c', 'user.name=agents-cfgit',
      '-c', 'user.email=agents-cfgit@local',
      'commit', '--no-verify', '--no-gpg-sign', '-m', 'init: 初始配置快照'], {
      cwd,
      env: { ...process.env, GIT_COMMITTER_DATE: gitDate, GIT_AUTHOR_DATE: gitDate },
    });
    return { initialized: true, skipped: false, message: 'git 仓库初始化完成' };
  } catch (err) {
    return { initialized: false, skipped: false, message: `初始化失败: ${err.message}` };
  }
}
