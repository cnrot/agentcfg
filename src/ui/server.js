import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

import { getLog } from '../core/log.js';
import { parseShow } from '../core/show.js';
import { buildStats } from '../core/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_DIR = join(__dirname, '../ui');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

/**
 * 启动 agents-cfgit WebUI server
 * @param {string[]} args
 * @returns {Promise<{port: number, host: string, url: string}>}
 */
export default {
  async start(args) {
    if (args.includes('--help') || args.includes('-h')) {
      printHelp();
      return;
    }
    const opts = parseArgs(args);
    const cwd = process.cwd();

    // --stop: 根据 PID 文件关闭已有进程
    if (opts.stop) {
      const pf = pidFilePath(opts.port);
      try {
        const pid = parseInt(readFileSync(pf, 'utf-8'), 10);
        try { process.kill(pid); } catch {}
        unlinkSync(pf);
        console.log(`  🛑 已关闭 WebUI (PID ${pid})`);
      } catch {
        console.log(`  ℹ️  端口 ${opts.port} 上没有运行中的 WebUI 实例`);
      }
      process.exit(0);
    }

    // --kill: 启动前自动释放旧进程
    if (opts.kill) killProcessOnPort(opts.port);

    const indexPath = join(UI_DIR, 'index.html');
    if (!existsSync(indexPath)) {
      console.error('❌ 找不到 WebUI 资源:', indexPath);
      console.error('   请确认 src/ui/index.html 存在（来自 npm publish 或本地源码）');
      process.exit(1);
    }

    const server = createServer((req, res) => handle(req, res, cwd, indexPath));
    await new Promise((resolveListen, reject) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ 端口 ${opts.port} 已被占用，请用 --port 指定其他端口`);
          process.exit(1);
        }
        reject(err);
      });
      server.listen(opts.port, opts.host, () => resolveListen());
    });

    const url = `http://${opts.host === '0.0.0.0' ? '127.0.0.1' : opts.host}:${opts.port}`;
    writePidFile(opts.port);
    console.log('');
    console.log(`  ✅ agents-cfgit WebUI 已启动`);
    console.log(`     ${url}`);
    console.log(`     数据源: ${cwd}`);
    console.log(`     Ctrl+C 关闭`);
    console.log('');

    if (opts.open) {
      openBrowser(url).catch(() => {});
    }

    // 优雅关闭
    const shutdown = () => {
      console.log('\n  🛑 关闭 WebUI');
      cleanPidFile(opts.port);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1500).unref();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // 占位符:让 server 引用不被打包移除(由 shutdown 退出)
    return new Promise(() => {});
  },
};

function parseArgs(args) {
  let port = 3000;
  let host = '127.0.0.1';
  let open = false;
  let kill = false;
  let stop = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      const v = parseInt(args[++i], 10);
      if (Number.isFinite(v) && v > 0 && v < 65536) port = v;
    } else if (args[i] === '--host' && i + 1 < args.length) {
      host = args[++i];
    } else if (args[i] === '--open') {
      open = true;
    } else if (args[i] === '--kill') {
      kill = true;
    } else if (args[i] === '--stop') {
      stop = true;
    }
  }
  return { port, host, open, kill, stop };
}

function printHelp() {
  console.log('用法: agents-cfgit ui [--port N] [--host H] [--open] [--kill] [--stop]');
  console.log('  --port N     监听端口（默认 3000）');
  console.log('  --host H     监听地址（默认 127.0.0.1；局域网访问用 0.0.0.0）');
  console.log('  --open       启动后自动调用系统默认浏览器');
  console.log('  --kill       启动前自动释放旧进程（基于 PID 文件或端口检测）');
  console.log('  --stop       关闭端口上的 WebUI 实例（基于 PID 文件）');
}

async function handle(req, res, cwd, indexPath) {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;

  // ---- API ----
  if (pathname === '/api/stats') return await apiStats(cwd, res);
  if (pathname === '/api/log') return await apiLog(cwd, url, res);
  if (pathname === '/api/diff') return await apiDiff(cwd, url, res);

  // ---- 静态文件 ----
  // 仅服务 ui/ 目录下的文件(防穿越)
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.includes('..')) return send(res, 403, 'text/plain', 'forbidden');
  const filePath = resolve(join(UI_DIR, rel.replace(/^\/+/, '')));
  if (!filePath.startsWith(UI_DIR)) return send(res, 403, 'text/plain', 'forbidden');
  if (!existsSync(filePath)) return send(res, 404, 'text/plain', 'not found');
  const st = await stat(filePath).catch(() => null);
  if (!st || !st.isFile()) return send(res, 404, 'text/plain', 'not found');
  const ext = '.' + filePath.split('.').pop();
  const mime = MIME[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'no-cache');
  res.end(await readFile(filePath));
}

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(body);
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(JSON.stringify(obj));
}

function requireGitRepo(cwd, res) {
  if (!existsSync(join(cwd, '.git'))) {
    sendJson(res, 503, { error: 'NOT_A_GIT_REPO', message: '当前目录不是 agents-cfgit 管理的 git 仓库,请先执行 `agents-cfgit init`' });
    return false;
  }
  return true;
}

async function apiStats(cwd, res) {
  if (!requireGitRepo(cwd, res)) return;
  try {
    const stats = await buildStats(cwd);
    sendJson(res, 200, stats);
  } catch (err) {
    sendJson(res, 500, { error: 'STATS_FAILED', message: err.message });
  }
}

async function apiLog(cwd, url, res) {
  if (!requireGitRepo(cwd, res)) return;
  const skip = Math.max(0, parseInt(url.searchParams.get('skip') || '0', 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  try {
    // 拿 skip+limit 条 commit,然后裁剪给前端
    const fetched = getLog({ cwd, count: skip + limit });
    const batch = fetched.slice(skip, skip + limit);

    // 给每条 commit 补 files[{n,s,i,d}]
    const commits = batch.map(c => ({
      ...c,
      files: getCommitFiles(cwd, c.hash),
    }));
    sendJson(res, 200, { commits, total: fetched.length });
  } catch (err) {
    sendJson(res, 500, { error: 'LOG_FAILED', message: err.message });
  }
}

async function apiDiff(cwd, url, res) {
  if (!requireGitRepo(cwd, res)) return;
  const hash = url.searchParams.get('hash');
  if (!hash) {
    sendJson(res, 400, { error: 'MISSING_HASH', message: '需要 ?hash=<commit>' });
    return;
  }
  // 防御:hash 只能是 hex(7-40 位),其它字符直接拒绝
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) {
    sendJson(res, 400, { error: 'INVALID_HASH', message: 'hash 必须是 hex 字符串' });
    return;
  }
  try {
    const result = parseShow({ cwd, hash });
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { error: 'DIFF_FAILED', message: err.message });
  }
}

/**
 * 单次 `git show --stat` 解析文件列表 (name, status, insertions, deletions)
 */
function getCommitFiles(cwd, hash) {
  try {
    // --name-status: 给出 A/M/D 状态
    // --numstat: 给出 insertions / deletions
    // 两次调用合并;N+1 次 git 调用的代价是 1 次的 1 倍,小数据可接受
    const nameStatus = execFileSync('git', ['show', '--name-status', '--format=', hash], {
      cwd, encoding: 'utf-8',
    }).trim();
    const numstat = execFileSync('git', ['show', '--numstat', '--format=', hash], {
      cwd, encoding: 'utf-8',
    }).trim();

    const insMap = new Map();
    for (const line of numstat.split('\n')) {
      // 形如 "3\t1\tfile.js" 或 "-\t-\tbinary.bin"
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      const i = m[1] === '-' ? 0 : parseInt(m[1], 10);
      const d = m[2] === '-' ? 0 : parseInt(m[2], 10);
      insMap.set(m[3], { i, d });
    }

    const files = [];
    for (const line of nameStatus.split('\n')) {
      // 形如 "M\tfile.js" 或 "A\tfile.js" 或 "R100\told\tnew"
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const status = parts[0].startsWith('A') ? 'A' : parts[0].startsWith('D') ? 'D' : 'M';
      const name = parts[parts.length - 1];
      const stat = insMap.get(name) || { i: 0, d: 0 };
      files.push({ n: name, s: status, i: stat.i, d: stat.d });
    }
    return files;
  } catch {
    return [];
  }
}

// ---- 进程管理 ----

function pidFilePath(port) {
  return join(tmpdir(), `agents-cfgit-ui-${port}.pid`);
}

function writePidFile(port) {
  try { writeFileSync(pidFilePath(port), String(process.pid)); } catch {}
}

function cleanPidFile(port) {
  try { unlinkSync(pidFilePath(port)); } catch {}
}

function killProcessOnPort(port) {
  // 先试 PID 文件（快速路径）
  const pf = pidFilePath(port);
  try {
    const pid = parseInt(readFileSync(pf, 'utf-8'), 10);
    try { process.kill(pid); } catch {}
    try { unlinkSync(pf); } catch {}
    console.log(`  🧹 已释放端口 ${port} (PID ${pid})`);
    return;
  } catch {}

  // 回退:通过系统工具检测端口占用
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano'], { encoding: 'utf-8', timeout: 3000 });
      for (const line of out.split('\n')) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'pipe', timeout: 3000 });
            console.log(`  🧹 已释放端口 ${port} (PID ${pid})`);
          }
        }
      }
    } else {
      const out = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8', timeout: 3000 }).trim();
      if (out) {
        for (const pid of out.split('\n').filter(Boolean)) {
          try { process.kill(parseInt(pid, 10), 'SIGTERM'); } catch {}
        }
        console.log(`  🧹 已释放端口 ${port}`);
      }
    }
  } catch {}
}

/**
 * 跨平台打开默认浏览器
 */
async function openBrowser(url) {
  const { spawn } = await import('node:child_process');
  const platform = process.platform;
  let cmd, args;
  if (platform === 'win32') {
    cmd = 'cmd'; args = ['/c', 'start', '""', url];
  } else if (platform === 'darwin') {
    cmd = 'open'; args = [url];
  } else {
    cmd = 'xdg-open'; args = [url];
  }
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
}
