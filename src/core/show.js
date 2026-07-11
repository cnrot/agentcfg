import { execFileSync } from 'child_process';

/**
 * 解析 `git show <hash>` 的输出,按文件分组成结构化 diff。
 * @param {object} opts
 * @param {string} opts.cwd - git 仓库目录
 * @param {string} opts.hash - 完整或短 commit hash
 * @returns {{ hash: string, files: Array<{name: string, status: 'A'|'M'|'D', lines: Array<{line: string, type: 'n'|'a'|'d'}>, startLine: number}> }}
 */
export function parseShow({ cwd, hash }) {
  // --format=: 空 commit 元信息,只保留 diff
  // --no-color: 关闭颜色转义(避免 ANSI 干扰解析)
  // -M: 检测重命名,简化 status 字母
  // --no-renames: 关闭重命名检测,与前端 mock 行为保持一致
  const raw = execFileSync('git', [
    'show', '--format=', '--no-color', '--no-renames', hash,
  ], { cwd, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });

  return { hash: hash.slice(0, 8), files: splitByFile(raw) };
}

/**
 * 把 `git show` 的纯文本按 diff --git a/... b/... 分块,每块解析为 lines[]。
 * 单测可见;内部被 parseShow 调用。
 * @param {string} raw - 完整 git show 输出
 * @returns {Array<{name: string, status: 'A'|'M'|'D', lines: Array<{line: string, type: 'n'|'a'|'d'}>, startLine: number}>}
 */
export function splitByFile(raw) {
  if (!raw.trim()) return [];
  const lines = raw.split('\n');
  const files = [];
  let current = null;  // {name, status, lines, startLine, hunkStart, hunkLen}
  let oldStart = 1;    // @@ hunk 中的旧文件起始行(用作 startLine)

  for (const line of lines) {
    // diff --git a/foo b/foo
    if (line.startsWith('diff --git ')) {
      if (current) files.push(current);
      // 提取 b/foo 路径(去前缀 "b/")
      const m = line.match(/^diff --git a\/.+ b\/(.+)$/);
      current = {
        name: m ? m[1] : '',
        status: 'M',
        lines: [],
        startLine: 1,
        _hunkHeaderSeen: false,
      };
      continue;
    }
    if (!current) continue;

    // new file mode → status A
    if (/^new file mode/.test(line)) { current.status = 'A'; continue; }
    // deleted file mode → status D
    if (/^deleted file mode/.test(line)) { current.status = 'D'; continue; }

    // --- a/foo / +++ b/foo(头两行) → 跳过
    if (line.startsWith('--- a/') || line.startsWith('+++ b/')) continue;
    // --- /dev/null(新文件) / +++ /dev/null(删除文件) → 跳过
    if (line === '--- /dev/null' || line === '+++ /dev/null') continue;
    // index ... → 跳过
    if (line.startsWith('index ')) continue;
    // rename ... → 跳过
    if (line.startsWith('rename ')) continue;
    if (line.startsWith('similarity ')) continue;
    if (line.startsWith('Binary files')) continue;
    // diff stat 行(如 "1 file changed, 0 insertions(+), 0 deletions(-)") — 只在末尾出现,跳过分块逻辑
    if (/^\d+ file.*changed/.test(line)) continue;
    // @@ -oldStart,oldLen +newStart,newLen @@
    if (line.startsWith('@@')) {
      const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        current._hunkHeaderSeen = true;
        oldStart = parseInt(m[1], 10);
        current.startLine = oldStart;
      }
      continue;
    }

    // diff 行首字母
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.lines.push({ line: line.slice(1), type: 'a' });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.lines.push({ line: line.slice(1), type: 'd' });
    } else if (line.startsWith(' ')) {
      current.lines.push({ line: line.slice(1), type: 'n' });
    } else if (line === '\\ No newline at end of file') {
      // 跳过 git 的"无换行符"提示
      continue;
    } else if (line.trim() === '') {
      // 空行 - 视为 'n'(unified diff 中以空格开头的行才能算 unchanged,空行就是 0 长 unchanged)
      // 但 fixture 里空行就是 '\n',split 出来就是 ''. 跳过它,避免误判
      continue;
    }
    // 其它行(如 "diff --git" 已被前一个块接收)忽略
  }
  if (current) files.push(current);
  // 清理内部标记
  for (const f of files) {
    delete f._hunkHeaderSeen;
  }
  return files;
}
