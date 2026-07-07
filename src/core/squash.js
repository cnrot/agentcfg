import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export function squashOldHistory({ cwd, daysThreshold = 90 }) {
  if (!existsSync(join(cwd, '.git'))) {
    return { squashed: false, message: '不是 git 仓库' };
  }
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().replace('T', ' ').slice(0, 19);
  const oldCommits = execFileSync('git', [
    'log', '--before', cutoffStr, '--format=%H', '--reverse',
  ], { cwd, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

  if (oldCommits.length === 0) {
    return { squashed: false, message: `无超过 ${daysThreshold} 天的 commit 需要压缩` };
  }

  const oldestHash = oldCommits[0];
  try {
    const tags = execFileSync('git', ['tag', '--points-at', oldestHash], {
      cwd, encoding: 'utf-8',
    }).trim();
    if (tags) {
      return { squashed: false, message: `commit ${oldestHash.slice(0, 8)} 有 tag 豁免，跳过压缩` };
    }
  } catch {}

  try {
    // 检查是否为根 commit（无父节点）
    let parentExists = false;
    try {
      execFileSync('git', ['rev-parse', `${oldestHash}^`], {
        cwd, encoding: 'utf-8',
      });
      parentExists = true;
    } catch {
      parentExists = false;
    }

    if (parentExists) {
      execFileSync('git', ['reset', '--soft', `${oldestHash}^`], { cwd });
    } else {
      // 根 commit：用 update-ref 删除 HEAD 引用，重新 add + commit
      execFileSync('git', ['update-ref', '-d', 'HEAD'], { cwd });
      execFileSync('git', ['add', '.'], { cwd });
    }

    execFileSync('git', [
      '-c', 'user.name=agentcfg',
      '-c', 'user.email=agentcfg@local',
      'commit', '--no-verify', '--no-gpg-sign', '-m',
      `archive: 自动压缩于 ${cutoffStr}（合并 ${oldCommits.length} 个 commit）`],
    { cwd, encoding: 'utf-8', env: { ...process.env, GIT_COMMITTER_DATE: new Date().toISOString() } });
  } catch (err) {
    return { squashed: false, message: `压缩失败: ${err.message}` };
  }

  return {
    squashed: true,
    message: `已压缩 ${oldCommits.length} 个 ${daysThreshold} 天前的 commit 为 archive commit`,
  };
}
