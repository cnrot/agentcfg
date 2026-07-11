# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

`agentcfg`（原名 `config-mgr`，见 git history 早期 commit）是一个基于 Git 的版本控制工具，专门管理 AI 编程 Agent（Claude Code / Cursor / Codex CLI / OpenCode）的配置文件。每次配置文件被修改前，hooks 自动触发 `git commit` 创建快照；用户通过对话式 SKILL.md 引导 AI agent 完成历史查看与三段式比对恢复。

**当前版本**：`package.json` 单一来源（v0.1.10）；npm 包名 `agentcfg`，CLI 入口 `bin/agentcfg.js`。

## 常用命令

### 测试

项目**不使用** jest/mocha 等测试框架，每个 `.test.js` 都是独立可运行的 Node.js 脚本，直接断言 stdout 退出码。

```bash
# 跑全部测试（package.json scripts.test 列出所有 .test.js，共 14 个）
npm test

# 跑单个测试文件
node src/core/commit.test.js
node src/hooks/claude.test.js
```

**Node 要求**：`>=18`（`package.json` engines 字段），仅使用 ESM（`"type": "module"`）。

**测试文件清单**（与 `package.json` scripts.test 同步，镜像 `src/` 布局放在 `tests/`）：
- CLI：`tests/bin/agentcfg.test.js`
- core：`tests/core/{init,commit,log,diff,squash,show,stats}.test.js`
- hooks：`tests/hooks/{claude,cursor,codex,opencode}.test.js`
- 编排：`tests/{install,recover,verify,templates,readme}.test.js`
- UI：`tests/ui/html-static.test.js`

### 本地安装/调试

```bash
# 从仓库根目录软链到全局
npm link

# 在任意位置验证
agentcfg --help
```

## 架构概览

CLI 入口在 `bin/agentcfg.js`（7 个子命令：`init` / `verify` / `status` / `log` / `diff` / `recover` / `squash` / `uninstall`）。每个子命令委托给 `src/<name>.js`，按需调用 `src/core/*.js` 和 `src/hooks/*.js`。

### 顶层模块（`src/`）

- **`install.js`** — 入口编排。`detectAgents()` 扫描 `~/.claude`、`~/.cursor`、`~/.codex` 和项目级 `.opencode/`，对每个 agent 调用 `core/init.js`（`git init` + 写 `.gitignore`）和对应 `hooks/*.js`（注册 PreToolUse）。最后把仓库根的 `SKILL.md` 复制到 `agent.dir/skills/agentcfg/SKILL.md`，并把 `__AGENT_DIR__` 占位符替换为实际目录名（`.claude` / `.cursor` 等）。
- **`recover.js`** — 对话式恢复入口。无参时打印最近 15 次 commit 引导；带文件路径则 `log.js` 列出该文件历史；带文件路径+commit hash 则 `diff.js` 输出三段式比对报告。**校验 commit hash 用 `git rev-parse --verify` 防止任意字符串注入**。
- **`uninstall.js`** — 调用各 `hooks/*.js` 的 uninstall 函数。Codex 特殊：先读 `config.toml.agentcfg-meta` 元数据还原原始 `hooks = true/false`，再清理 `.bak.agentcfg` 文件。
- **`verify.js`** — 一键验证 / 卸载预览（`--uninstall` 为 dry-run）。

### 核心层（`src/core/`）

所有函数都接收 `{ cwd, ... }` 参数显式指定工作目录，**不依赖全局状态**。

- **`init.js`** — 幂等。`execFileSync('git', ['init'])`，从 `templates/gitignore` 拷贝，提交 `init: 初始配置快照`。
- **`commit.js`** — Hook 调用入口。检查 `git status --porcelain` 是否有变更；**校验 `settings.json` 是合法 JSON**（防止损坏文件被提交）；执行 `git add .` + commit。`source` / `toolName` 写入 commit message 前缀（`auto: [pre_tool] snapshot before Bash at 2026-07-10 ...`）。CLI 入口（文件底部）解析 `--dir`、`--source`、`--tool` 参数；`--dir` 由 hooks 安装时通过 `__CONFIG_DIR__` 占位符注入，**不要依赖 `process.cwd()`**（hook 上下文不可控）。
- **`log.js`** — `git log --format=%H|%ci|%s` 解析，hash 截前 8 位。
- **`diff.js`** — 三段式报告。`git show <hash>:<filePath>` 取历史，`readFileSync` 取当前，`git diff <hash> -- <file>` 按 `+`/`-`/空格 拆出"新增/已移除/共有"。
- **`squash.js`** — 压缩 90 天前 commit。先用 `git status --porcelain` 检查工作区干净；用 `git tag --points-at` 检查**是否有 tag 豁免**（打了 tag 的 commit 不被压缩）；分两种情况处理：所有 commit 都过期 vs. 混合新旧（混合情况用临时分支 + rebase `--onto` + catch 内 rollback 到 `backup-before-squash` 分支）。

### Hooks 层（`src/hooks/`）

每个 agent 都有自己的 hook 注册/卸载函数。**所有 hook 都指向同一脚本**：`src/core/commit.js`（安装时把绝对路径写入 `settings.json` / `hooks.json` / 插件）。

- **`claude.js`** — 写 `~/.claude/settings.json` 的 `hooks.PreToolUse`。**用 `.endsWith('commit.js')` 字符串匹配实现幂等检测和增量卸载**，避免误删其他工具的 hook。Windows 路径的反斜杠会被 `.replace(/\\/g, '\\\\')` 转义再嵌入 JSON 模板。
- **`cursor.js`** — 写 `~/.cursor/hooks.json`，注册 `beforeShellExecution` + `afterFileEdit` 两种事件。
- **`codex.js`** — 写 `~/.codex/hooks.json` + 修改 `~/.codex/config.toml` 的 `[features] hooks = true`（Codex 需 feature flag 开启）。安装时把原始 `hooks` 值和是否已有 `[features]` 段写入 `config.toml.agentcfg-meta` 文件，卸载时按元数据精确还原。
- **`opencode.js`** — 把 `templates/plugin-opencode.ts` 复制到 `.opencode/plugins/agentcfg.ts`。**插件内所有外部输入都用 `shellQuote()` 单引号包裹 + 内部单引号转义**，防止 shell 注入。

### 模板（`templates/`）

- `gitignore` — 排除 `backups/`、`.runtime/`、`sessions/`、`*.bak.*` 等临时文件
- `hooks-{claude,cursor,codex}.json` — 模板里 `__COMMIT_SCRIPT__` 占位符在安装时被 commit.js 的绝对路径替换
- `plugin-opencode.ts` — OpenCode 插件源码

## 关键约定

### Git 操作

- 统一用 `execFileSync`（不用 `exec`），参数用数组形式（防命令注入）
- 所有 commit 都用 `-c user.name=agentcfg -c user.email=agentcfg@local` 注入 user 配置，规避全局未配置
- 所有 commit 加 `--no-verify --no-gpg-sign`（hook 自调用不能再次触发 hook；不签名）
- commit message 时间戳用 `GIT_COMMITTER_DATE` / `GIT_AUTHOR_DATE` 环境变量

### Git 身份与 commit 署名

- **禁止使用 `Co-Authored-By:` trailer 标记 Claude/anthropic**（任何变体都不行，包括 `Claude Opus 4.7 <noreply@anthropic.com>`、其他 Claude 模型、`noreply@anthropic.com` 邮箱）
- **禁止把 git author / committer 设为 `claude` 或 `noreply@anthropic.com`** —— Contributors 页面会显示该 author
- 提交时 author/committer 必须用仓库的 git config（即 `Rowe <inetech@zohomail.com>`）
- 缘由：GitHub Contributors 页面同时统计 author 和 co-author，Co-Authored-By 行会让 `claude` 出现在 Contributors 上。本仓库主仓 `cnrot/agentcfg` 历史曾因此包含 14 条 Co-Authored-By Claude commit，已用 `git filter-repo --message-callback` 重写并 force-push 清掉
- 自检：commit 前 `git log -1 --format='%B' | grep -iE 'Co-Authored-By.*(claude|anthropic|noreply)'` 必须无输出

### 数据安全模式

- **设置文件校验**：`commit.js` 提交前 `JSON.parse` 校验 `settings.json` 合法性
- **Codex 元数据**：安装时记录原始 `hooks` 值到 `config.toml.agentcfg-meta`，卸载时按元数据精确还原
- **Squash 备份**：执行 squash 前 `git branch -f backup-before-squash`，catch 内 `git reset --hard backup-before-squash` 兜底
- **卸载增量剥离**：`claude.js` uninstall 用 filter 移除 agentcfg 条目而非 `cp` 覆盖整文件

### 路径占位符

- `SKILL.md` 里的 `__AGENT_DIR__` → `.claude` / `.cursor` / `.codex` / `.opencode`（`install.js` 替换）
- `templates/hooks-*.json` 里的 `__COMMIT_SCRIPT__` → `src/core/commit.js` 绝对路径（`hooks/*.js` 替换）
- `templates/plugin-opencode.ts` 没有占位符，因为 OpenCode 插件是独立项目，直接整文件拷贝

## 添加新 Agent 支持的步骤

1. 在 `templates/` 加 `hooks-<name>.json`（或插件模板），里面用 `__COMMIT_SCRIPT__` 占位符
2. 在 `src/hooks/` 加 `<name>.js`，导出 `install<Name>Hooks(dir, commitScriptPath)` 和 `uninstall<Name>Hooks(dir)`
3. 在 `src/install.js` 的 `detectAgents()` 加检测逻辑，`install()` 主循环加 `case '<name>':`
4. 在 `src/uninstall.js` 的 agents 数组加一项
5. 在 `src/hooks/<name>.test.js` 写测试
6. 在 `package.json` 的 `scripts.test` 末尾加 `&& node src/hooks/<name>.test.js`
7. 同步更新 `README.md` 的"支持的 AI 工具"列表和 `SKILL.md` 故障排查章节

## 调试技巧

- `agentcfg init` 失败时直接 `node -e "import('./src/core/init.js').then(m => console.log(m.initGit(process.cwd())))"` 单独跑 init 逻辑
- Hook 没触发：先 `cat ~/.claude/settings.json | grep -A 5 PreToolUse` 确认注册成功；再 `ls -la <node_modules>/agentcfg/src/core/commit.js` 确认路径可达
- `agentcfg recover` 报"无效的 commit hash"：先 `cd ~/.claude && git log --oneline` 复制完整 hash
- 测试是 `node tests/<path>/<file>.test.js` 直接跑，**断言失败通过 `process.exit(1)` 实现**，没有 test runner 输出格式
- 跑单个测试：`node tests/core/commit.test.js`（从仓库根目录）
