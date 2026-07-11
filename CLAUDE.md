# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

`agentcfg` 是基于 Git 的版本控制工具，专门管理 AI 编程 Agent（Claude Code / Cursor / Codex CLI / OpenCode）的配置文件。每次配置文件被修改前，hooks 自动触发 `git commit` 创建快照；用户通过对话式 `SKILL.md` 引导 AI agent 完成历史查看与三段式比对恢复。

**版本来源**：`package.json` 单一来源；npm 包名 `agentcfg`，CLI 入口 `bin/agentcfg.js`。

## 常用命令

### 本地安装/调试

```bash
npm link           # 从仓库根目录软链到全局
agentcfg --help    # 在任意位置验证
```

**Node 要求**：`>=18`（`package.json` engines 字段），仅使用 ESM（`"type": "module"`）。

## 架构概览

CLI 入口在 `bin/agentcfg.js`（7 个子命令：`init` / `verify` / `status` / `log` / `diff` / `recover` / `squash` / `uninstall`）。每个子命令委托给 `src/<name>.js`，按需调用 `src/core/*.js` 和 `src/hooks/*.js`。

### 顶层模块（`src/`）

- **`install.js`** — 入口编排。`detectAgents()` 扫描 `~/.claude`、`~/.cursor`、`~/.codex` 和项目级 `.opencode/`，对每个 agent 调用 `core/init.js`（`git init` + 写 `.gitignore`）和对应 `hooks/*.js`（注册 PreToolUse）。最后把仓库根的 `SKILL.md` 复制到 `agent.dir/skills/agentcfg/SKILL.md`，并把 `__AGENT_DIR__` 占位符替换为实际目录名。
- **`recover.js`** — 对话式恢复入口。无参时打印最近 15 次 commit 引导；带文件路径则 `log.js` 列出该文件历史；带文件路径+commit hash 则 `diff.js` 输出三段式比对报告。
- **`uninstall.js`** — 调用各 `hooks/*.js` 的 uninstall 函数。Codex 特殊：先读 `config.toml.agentcfg-meta` 元数据还原原始 `codex_hooks = true/false`。
- **`verify.js`** — 一键验证 / 卸载预览（`--uninstall` 为 dry-run）。

### 核心层（`src/core/`）

所有函数都接收 `{ cwd, ... }` 参数显式指定工作目录，**不依赖全局状态**。

- **`init.js`** — 幂等。`execFileSync('git', ['init'])`，从 `templates/gitignore` 拷贝，提交 `init: 初始配置快照`。
- **`commit.js`** — Hook 调用入口。检查 `git status --porcelain` 是否有变更；**校验 `settings.json` 是合法 JSON**（防止损坏文件被提交）；执行 `git add .` + commit。CLI 入口（文件底部）解析 `--dir`、`--source`、`--tool` 参数。
- **`log.js`** — `git log --format=%H|%ci|%s` 解析，hash 截前 8 位。
- **`diff.js`** — 三段式报告。`git show <hash>:<filePath>` 取历史，`readFileSync` 取当前，`git diff <hash> -- <file>` 按 `+`/`-`/空格 拆出"新增/已移除/共有"。
- **`squash.js`** — 压缩 90 天前 commit。先用 `git status --porcelain` 检查工作区干净；用 `git tag --points-at` 检查**是否有 tag 豁免**（打了 tag 的 commit 不被压缩）；分两种情况处理：所有 commit 都过期 vs. 混合新旧（混合情况用临时分支 + rebase `--onto` + catch 内 rollback 到 `backup-before-squash` 分支）。

### Hooks 层（`src/hooks/`）

每个 agent 都有自己的 hook 注册/卸载函数。**所有 hook 都指向同一脚本**：`src/core/commit.js`（安装时把绝对路径写入 `settings.json` / `hooks.json` / 插件）。

- **`claude.js`** — 写 `~/.claude/settings.json` 的 `hooks.PreToolUse`。**用 `.includes('commit.js')` 字符串匹配实现幂等检测**。**路径必须转成正斜杠**（Windows 反斜杠被 shell 吃掉）。
- **`cursor.js`** — 写 `~/.cursor/hooks.json`，注册 `beforeShellExecution` + `afterFileEdit` 两种事件。
- **`codex.js`** — 写 `~/.codex/hooks.json` + 修改 `~/.codex/config.toml` 的 `[features] codex_hooks = true`。Codex hooks.json 使用**扁平格式**（`[{ "command": "..." }]`），不是 Claude 的嵌套格式（`[{ "matcher": "...", "hooks": [...] }]`）。安装时把原始 `codex_hooks` 值和是否已有 `[features]` 段写入 `config.toml.agentcfg-meta` 文件，卸载时按元数据精确还原。
- **`opencode.js`** — 把 `templates/plugin-opencode.ts` 复制到 `.opencode/plugins/agentcfg.ts`。**插件内所有外部输入都用 `shellQuote()` 单引号包裹 + 内部单引号转义**，防止 shell 注入。

### 模板（`templates/`）

- `gitignore` — 排除 `backups/`、`.runtime/`、`sessions/`、`*.bak.*` 等临时文件
- `hooks-{claude,cursor,codex}.json` — 模板里 `__COMMIT_SCRIPT__` 和 `__CONFIG_DIR__` 占位符在安装时被替换为 commit.js 绝对路径和 agent 目录
- `plugin-opencode.ts` — OpenCode 插件源码（无占位符，直接整文件拷贝）

## 关键约定

### Git 操作

- 统一用 `execFileSync`（不用 `exec`），参数用数组形式（防命令注入）
- 所有 commit 都用 `-c user.name=agentcfg -c user.email=agentcfg@local` 注入 user 配置，规避全局未配置
- 所有 commit 加 `--no-verify --no-gpg-sign`（hook 自调用不能再次触发 hook；不签名）
- commit message 时间戳用 `GIT_COMMITTER_DATE` / `GIT_AUTHOR_DATE` 环境变量

### Git 身份与 commit 署名

- **禁止使用 `Co-Authored-By:` trailer 标记 Claude/anthropic**
- **禁止把 git author / committer 设为 `claude` 或 `noreply@anthropic.com`** — Contributors 页面会显示该 author
- 提交时 author/committer 必须用仓库的 git config

### 数据安全模式

- **设置文件校验**：`commit.js` 提交前 `JSON.parse` 校验 `settings.json` 合法性
- **Codex 元数据**：安装时记录原始 `codex_hooks` 值到 `config.toml.agentcfg-meta`，卸载时按元数据精确还原
- **Squash 备份**：执行 squash 前 `git branch -f backup-before-squash`，catch 内 `git reset --hard backup-before-squash` 兜底
- **卸载增量剥离**：`claude.js` uninstall 用 filter 移除 agentcfg 条目而非 `cp` 覆盖整文件

### 路径占位符

- `SKILL.md` 里的 `__AGENT_DIR__` → `.claude` / `.cursor` / `.codex` / `.opencode`（`install.js` 替换）
- `templates/hooks-*.json` 里的 `__COMMIT_SCRIPT__` → `src/core/commit.js` 绝对路径，`__CONFIG_DIR__` → agent 目录（`hooks/*.js` 替换）
- `templates/plugin-opencode.ts` 没有占位符，因为 OpenCode 插件是独立项目，直接整文件拷贝

## Bug 记录：Hook 触发后不自动提交

### 现象

`agentcfg init` 安装成功，settings.json 写了 hook，但修改配置文件后触发 Bash，git log 没有新 commit。

### 根因（三处缺失）

**`commit.js` CLI 入口用 `process.cwd()` 当工作目录**，但 hook 被 Claude Code 运行时 cwd 是当前项目目录（如 `G:\github\agentcfg`），不是 agent 配置目录（如 `C:\Users\admin\.claude`）。`git status --porcelain` 在错目录跑，永远输出空，返回"无未提交变更，跳过"。

### 修复方案（三处联动改）

```mermaid
graph LR
    A[templates/*.json] -- 加 --dir __CONFIG_DIR__ 占位符 --> B[hooks/*.js install 函数]
    B -- 替换为真实目录注入 command --> C[commit.js CLI 入口]
    C -- 解析 --dir 参数作为 cwd --> D[正确目录下 git commit]
```

详见各文件的改动：

| 位置 | 改了什么 | 为什么 |
|---|---|---|
| `src/core/commit.js:61-68` | CLI 入口解析 `--dir` 参数，优先用它当 `cwd`，没有才 fallback 到 `process.cwd()` | hook 触发时不知道目标目录，必须外部注入 |
| `templates/hooks-{claude,cursor,codex}.json` | command 加 `node` 前缀 + `--dir __CONFIG_DIR__` 占位符 | Windows 下裸 `.js` 无法直接运行；必须告诉 commit.js 去看哪个目录 |
| `src/hooks/{claude,cursor,codex}.js` | 安装时 `replaceAll('__CONFIG_DIR__', escapedDir)` + 路径改为正斜杠 | 把占位符替换为实际 agent 目录；正斜杠防止 shell 转义反斜杠 |

### Windows 平台注意事项

1. **路径必须用正斜杠**（`/` 而非 `\\`），Node.js 在 Windows 原生支持正斜杠，而 `\` 会被 shell 当作转义字符吞掉
2. **command 必须加 `node` 前缀**，Git Bash 不认裸的 `.js` 文件路径
3. **Codex CLI hooks.json 使用扁平格式**，不是 Claude Code 的嵌套格式：`{ "hooks": { "PreToolUse": [{ "command": "..." }] } }` 而非 `{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "..." }] }] } }`
4. **Codex CLI feature flag 是 `codex_hooks = true`**，不是 `hooks = true`

### 验证步骤

```bash
# 1. 确认 hook command 包含 node 前缀、--dir、正斜杠
grep "commit.js" ~/.claude/settings.json

# 2. 产生变更
echo "test" >> ~/.claude/settings.json

# 3. 触发 hook（任何 Bash 工具调用）
echo "trigger"

# 4. 确认有新 commit
cd ~/.claude && git log --oneline | head -3
```

## 添加新 Agent 支持的步骤

1. 在 `templates/` 加 `hooks-<name>.json`（或插件模板），用 `__COMMIT_SCRIPT__` 和 `__CONFIG_DIR__` 占位符
2. 在 `src/hooks/` 加 `<name>.js`，导出 `install<Name>Hooks(dir, commitScriptPath)` 和 `uninstall<Name>Hooks(dir)`
3. 在 `src/install.js` 的 `detectAgents()` 加检测逻辑，`install()` 主循环加 `case '<name>':`
4. 在 `src/uninstall.js` 的 agents 数组加一项
5. 同步更新 `README.md` 的"支持的 AI 工具"列表和 `SKILL.md` 故障排查章节

### 新 Agent 注册时的关键检查点

- [ ] hooks 的 command 加了 `node` 前缀吗？（Windows 必须）
- [ ] command 包含 `--dir __CONFIG_DIR__` 吗？
- [ ] install 函数把路径替换为正斜杠了吗？（`.replace(/\\/g, '/')`）
- [ ] hooks.json 格式是 agent 要求的格式吗？（Codex 扁平 vs Claude 嵌套）
- [ ] feature flag 名称跟对应 agent 的文档一致吗？

## 调试技巧

- `agentcfg init` 失败时直接 `node -e "import('./src/core/init.js').then(m => console.log(m.initGit(process.cwd())))"` 单独跑 init 逻辑
- Hook 没触发：先 `grep -A 2 commit.js ~/.claude/settings.json` 确认 command 格式正确（必须有 `node` 前缀 + `--dir` + 正斜杠）；再确认 `.git` 仓库存在
- `agentcfg recover` 报"无效的 commit hash"：先 `cd ~/.claude && git log --oneline` 复制完整 hash
- 怀疑 `commit.js` 本身出错：手动跑一次 `node src/core/commit.js --dir ~/.claude --source test --tool Bash` 看输出
