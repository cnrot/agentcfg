# agentcfg

> AI 编程 Agent 工具的配置文件版本控制 —— 每次修改前自动备份，对话式恢复。

[![npm version](https://img.shields.io/npm/v/agentcfg.svg)](https://www.npmjs.com/package/agentcfg)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-270%20passing-brightgreen.svg)](#testing)

你花几周打磨的 `CLAUDE.md`、`SKILL.md`、agent 配置、Cursor rules —— 这些是核心资产。一次误改、误删，几天心血归零。

`agentcfg` 把这些配置变成 Git 仓库，每次修改前自动 `git commit` 留痕；恢复时通过对话让 AI 给你三段式比对报告，**精准合并，不暴力覆盖**。

## 项目名称与定位

`agentcfg`是一个基于 Git 的版本控制工具，专门管理 AI 编程 Agent（Claude Code / Cursor / Codex CLI / OpenCode）的配置文件。每次配置文件被修改前，hooks 自动触发 `git commit` 创建快照；用户通过对话式 [`SKILL.md`](SKILL.md) 引导 AI agent 完成历史查看与三段式比对恢复。

## 为什么需要 agentcfg

| 你需要的能力 | 手动 `git init` | agentcfg |
|---|---|---|
| 自动备份（修改前 commit） | 写 hook | ✅ 内置 |
| 每个 AI 工具目录各自独立仓库 | 手动建 + 维护 | ✅ 自动检测 |
| 卸载时还原原始配置 | 自己记 / 备份 settings.json | ✅ 按原始值精确还原 |
| 损坏的 settings.json | 手动修 | ✅ 校验 + 保护后续编辑 |
| 90 天前的 commit 自动压缩 | 写脚本 | ✅ `agentcfg squash` |
| 跨平台（Win/macOS/Linux） | 各写一份 | ✅ `execFileSync` 防注入 |
| AI 帮你恢复 | 自己读 git log | ✅ `SKILL.md` 引导对话式恢复 |

## 技术栈

- **运行时**：Node.js ≥ 18（`engines.node`，仅使用 ESM 模块）
- **模块系统**：ESM（`package.json` 中 `"type": "module"`）
- **依赖**：**零外部 npm 依赖**（所有能力使用 Node 内置 `fs` / `path` / `child_process` / `crypto`）
- **版本控制**：[Git](https://git-scm.com/)（hook 自调用时不再次触发 hook；`--no-verify --no-gpg-sign`）
- **CLI 入口**：`bin/agentcfg.js`
- **跨平台**：Windows / macOS / Linux（所有 git 命令通过 `execFileSync` + 数组参数防注入）
- **AI Agent hook 适配**：Claude Code `PreToolUse`、Cursor `beforeShellExecution` + `afterFileEdit`、Codex CLI `PreToolUse`、OpenCode `tool.execute.before` + `file.edited`

## 快速开始

### 环境要求

- Node.js ≥ 18
- Git
- 至少一个 AI 工具配置目录：`~/.claude` / `~/.cursor` / `~/.codex`，或项目级 `.opencode/`

### 安装

```bash
# 1. 全局安装
npm install -g agentcfg

# 2. 在你的 AI 工具配置目录初始化
agentcfg init
# 检测到 2 个 agent:
#   claude: C:\Users\xxx\.claude
#   codex:  C:\Users\xxx\.codex
# ✅ 全部 agent 已安装 agentcfg
```

安装完成后，AI agent 下次对话时会自动读取 `SKILL.md` 学会怎么帮你恢复配置。

### 验证

```bash
agentcfg verify
# claude (C:\Users\xxx\.claude):
#   ✅ claude: .git 仓库
#   ✅ claude: .gitignore
#   ✅ claude: 至少 1 个 commit
#   ✅ claude: hook 注册
#   ✅ claude: SKILL.md
# ✅ 全部检查通过
```

### 本地开发 / 调试

```bash
# 从仓库根目录软链到全局
npm link

# 在任意位置验证
agentcfg --help
```

## 支持的 AI 工具

| 工具 | hook 事件 | 备注 |
|---|---|---|
| **Claude Code** | `PreToolUse` | 写 `~/.claude/settings.json`，幂等检测避免误删 |
| **Cursor** | `beforeShellExecution` + `afterFileEdit` | 写 `~/.cursor/hooks.json` |
| **Codex CLI** | `PreToolUse` | 需 `[features] hooks = true`；按 `config.toml.agentcfg-meta` 精确还原 |
| **OpenCode** | `tool.execute.before` + `file.edited` | 复制 TypeScript 插件到 `.opencode/plugins/agentcfg.ts` |

## 项目结构

```
agentcfg/
├── bin/
│   ├── agentcfg.js              CLI 入口（7 个子命令）
│   └── agentcfg.test.js         CLI 参数解析测试
├── src/
│   ├── core/                    git 操作核心
│   │   ├── init.js              幂等的 git init + .gitignore
│   │   ├── commit.js            hook 调用的 commit 入口
│   │   ├── log.js               git log 解析
│   │   ├── diff.js              三段式比对报告
│   │   └── squash.js            90 天压缩（带 backup-before-squash 兜底）
│   ├── hooks/                   每个 agent 一个适配器
│   │   ├── claude.js            ~/.claude/settings.json
│   │   ├── cursor.js            ~/.cursor/hooks.json
│   │   ├── codex.js             ~/.codex/{hooks.json,config.toml}
│   │   └── opencode.js          .opencode/plugins/agentcfg.ts
│   ├── install.js               安装编排
│   ├── uninstall.js             卸载（含 .bak.agentcfg 清理）
│   ├── recover.js               对话式恢复引导
│   ├── verify.js                一键验证 / 卸载预览
│   └── templates.test.js        模板完整性测试
├── templates/                   hook + 插件 + .gitignore 模板
│   ├── gitignore
│   ├── hooks-claude.json
│   ├── hooks-cursor.json
│   ├── hooks-codex.json
│   └── plugin-opencode.ts
├── SKILL.md                     给 AI agent 看的操作手册
├── UNINSTALL.md                 卸载与手动清理指南
├── CLAUDE.md                    给 Claude Code 看的项目说明
├── package.json                 零外部依赖；ESM；engines >= 18
└── LICENSE                      MIT
```

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│                    bin/agentcfg.js                    │
│              （7 个子命令：init/verify/...）            │
└────────┬──────────┬──────────┬──────────┬─────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
   ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
   │ install  │ │recover │ │ uninstall│ │  verify  │
   └────┬─────┘ └───┬────┘ └────┬─────┘ └──────────┘
        │           │           │
        │           │           │
        ▼           ▼           ▼
   ┌────────────────────────────────────────┐
   │            src/core/*.js               │
   │  init / commit / log / diff / squash   │
   └────────────────┬───────────────────────┘
                    │
                    ▼
   ┌────────────────────────────────────────┐
   │          src/hooks/<agent>.js          │
   │  claude / cursor / codex / opencode    │
   └────────────────┬───────────────────────┘
                    │
                    ▼
   ┌────────────────────────────────────────┐
   │       AI 工具配置目录（用户机器上）     │
   │   ~/.claude / ~/.cursor / ~/.codex /   │
   │            .opencode/                  │
   └────────────────────────────────────────┘
```

**关键设计**：
- 所有 `core/*.js` 函数都接收 `{ cwd, ... }` 显式指定工作目录，**不依赖 `process.cwd()`**（hook 上下文不可控）。
- 所有 hook 都指向**同一脚本**：`src/core/commit.js`（安装时把绝对路径写入 `settings.json` / `hooks.json` / 插件）。
- `templates/hooks-*.json` 里的 `__COMMIT_SCRIPT__` 占位符在安装时被 commit.js 绝对路径替换。
- `SKILL.md` 里的 `__AGENT_DIR__` 占位符在安装时替换为 `.claude` / `.cursor` / `.codex` / `.opencode`。

## 命令一览

```bash
agentcfg init                # 安装到当前 AI 工具环境
agentcfg verify              # 一键验证：.git / .gitignore / commit / hook / SKILL.md
agentcfg verify --uninstall  # 预览卸载影响（dry-run）
agentcfg status              # 各 agent 工作区状态
agentcfg log [file]          # 查看历史（默认最近 10 条）
agentcfg diff <file> <hash>  # 生成三段式比对报告
agentcfg recover [file] [hash]  # 对话式恢复引导
agentcfg squash [--days N] [--force]  # 压缩 N 天前的 commit（默认 90）
agentcfg uninstall           # 卸载
```

每个命令支持 `--help` 查看详细用法。

## 关键特性

- **自动备份**：hook 监听 AI 工具的 `PreToolUse` / `beforeShellExecution` / `afterFileEdit` 等事件，**修改前**自动 `git commit` 留痕。
- **多 agent 支持**：一个 `init` 扫描 `~/.claude` / `~/.cursor` / `~/.codex` 和项目级 `.opencode/`，每个目录独立 git 仓库。
- **三段式比对恢复**：从历史里挑出哪些内容回到当前文件是**判断**，不是操作；agentcfg 生成 `+ 新增 / - 已移除 / = 共有` 报告，由 AI agent 用 Edit 工具精确写入，**不暴力覆盖**。
- **安全注入防护**：所有 git 命令走 `execFileSync`，参数以数组形式传子进程，配置内容里的任何字符都不会被解释成命令。
- **配置保护**：提交前 `JSON.parse` 校验 `settings.json` 合法性；卸载时按 `config.toml.agentcfg-meta` 元数据精确还原 Codex 原值；squash 前 `git branch -f backup-before-squash` 兜底。
- **增量卸载**：`claude.js` uninstall 用 `filter` 移除 agentcfg 条目而非 `cp` 覆盖整文件，用户的其他配置一字不动。
- **90 天自动压缩**：默认按 tag 豁免 + 临时分支 + rebase `--onto` 合并过期 commit，带回滚分支。
- **零外部依赖**：仅使用 Node 内置模块，npm 包体积小、安装快。

## 对话式恢复（核心场景）

`agentcfg` 是**只读**的——只生成报告，不动文件。

示例对话：

> 你：帮我把前天改的 CLAUDE.md 找回来
> Agent：找到以下历史版本
>         1. [a1b2c3d] 2026-07-09 — auto: snapshot before Bash
>         2. [e4f5g6h] 2026-07-08 — manual: 调整 hook 顺序
>
>
> 你：用第一个版本比对
> Agent：（输出三段式报告：新增 / 已移除 / 共有）
>
>
> 你：只把"新增"区块合并进来
> Agent：（用 Edit 工具精确写入，不覆盖整文件）

三个禁止：
1. 不会使用 `git checkout` 直接覆盖文件
2. 不会使用 `cp` 覆盖整文件
3. 即使文件被删除，也先查 `git log` 确认是否存在过

详细流程见 [`SKILL.md`](SKILL.md)

## 设计原则

- **为什么需要**：AI 编程 agent 的核心配置和文档会越攒越多，时间久了之后，一次误改、误删就找不回来。
- **为什么用 git**：git 的版本控制天然适合做生命周期追踪——能恢复到任意历史版本，diff 工具现成，跨平台一致。
- **为什么靠 hook**：git 是"改完后提交"才有记录，但人不会为每次配置修改手动 commit。agentcfg 把这个动作绑到 agent 的工具调用上——下次执行任何工具前，hook 自动触发一次 git commit，恰好的变成了：“改前先备份"的效果。
- **为什么走对话式恢复**：能从历史里挑出哪些内容回到当前配置文件，恢复什么内容由用户自己选择做这个决定。
- **卸载原则**：agentcfg 卸载时只摘掉与之相关的部分，其他配置一字不动。

## 安全考虑

- **shell 注入防护**：所有 git 命令都不走 shell，参数以数组形式传给子进程，配置内容里的任何字符都不会被解释成命令。
- **OpenCode 插件**：所有外部输入用 `shellQuote()` 单引号包裹 + 内部单引号转义。
- **用户数据保护**：agentcfg 在用户配置里写入的内容都遵循"只增不覆盖"——hooks 文件加新条目，卸载时只摘除 agentcfg 自己写的那几条；codex 涉及另一个独立文件时，agentcfg 在动它之前先把原样备份下来，卸载时按备份还原。
- **commit 路径注入防御**：`recover.js` 用 `git rev-parse --verify` 校验 commit hash 防止任意字符串注入。
- **损坏文件防护**：`commit.js` 提交前 `JSON.parse` 校验 `settings.json` 合法性，损坏文件不被提交。

## Testing

项目**不使用** jest/mocha 等测试框架，每个 `.test.js` 都是独立可运行的 Node.js 脚本，直接断言 stdout 退出码（断言失败通过 `process.exit(1)` 实现，没有 test runner 输出格式）。

```bash
# 跑全部测试（package.json scripts.test 列出所有 .test.js）
npm test

# 跑单个测试文件
node src/core/commit.test.js
node src/hooks/claude.test.js
```

**Node 要求**：`>=18`（`package.json` engines 字段），仅使用 ESM（`"type": "module"`）。

### 当前测试覆盖

- `bin/agentcfg.test.js` — CLI 参数解析
- `src/core/{commit,init,log,diff,squash}.test.js` — 核心 git 操作
- `src/hooks/{claude,cursor,codex,opencode}.test.js` — 各 agent hook 适配
- `src/templates.test.js` — 模板完整性
- `src/install.test.js` — 安装流程
- `src/recover.test.js` — 对话式恢复
- `src/verify.test.js` — 一键验证

## Contributing

- 报告 bug / 提需求：[GitHub Issues](../../issues)


## 卸载

```bash
# 预览（推荐）
agentcfg verify --uninstall

# 实际卸载
agentcfg uninstall

# 卸载完成后必须重启 AI 工具会话（Cursor / Claude Code 等）使卸载生效
```

详细手动清理步骤见 [`UNINSTALL.md`](UNINSTALL.md)。

## License

[MIT](LICENSE) — Copyright (c) 2026 agentcfg contributors
