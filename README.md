# agentcfg

> AI 编程 Agent 的配置文件版本控制 —— 每次修改前自动备份，对话式恢复。

[![npm version](https://img.shields.io/npm/v/agentcfg.svg)](https://www.npmjs.com/package/agentcfg)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-221%20passing-brightgreen.svg)](#testing)

你花几周打磨的 `CLAUDE.md`、`SKILL.md`、agent 配置这些是核心资产。如果出现误改、误删，几天心血归零。

`agentcfg` 把这些配置变成 Git 仓库，每次修改前自动 `git commit` 留痕；恢复时通过对话让 AI 给你三段式比对报告，**精准合并，不暴力覆盖**。

## 项目介绍

`agentcfg`是一个基于 Git 的版本控制，专门管理 AI 编程 Agent（Claude Code / Cursor / Codex CLI / OpenCode）的配置文件。每次配置文件被修改前，hooks 自动触发 `git commit` 创建快照；用户通过对话式 [`SKILL.md`](SKILL.md) AI agent 完成历史查看与三段式比对恢复。

### 为什么需要 agentcfg

| 对比 | 手动 `git init` | agentcfg |
|---|---|---|
| 自动备份| 写 hook | ✅ 内置 |
| 每个 Agent 目录各自独立仓库 | 手动建 + 维护 | ✅ 自动检测 |
| 卸载时还原配置 | 自己记 / 备份 settings.json | ✅ 按原始值精确还原 |
| 损坏的 settings.json | 手动修 | ✅ 校验 + 保护后续编辑 |
| 90 天前的 commit 自动压缩 | 写脚本 | ✅ `agentcfg squash` |
| 跨平台（Win/Linux） | 各写一份 | ✅ `execFileSync` 防注入 |
| AI 帮你恢复 | 自己读 git log | ✅ `SKILL.md` 引导对话式恢复 |

### 支持的 Agent 

|  | hook 事件 | 备注 |
|---|---|---|
| **Claude Code** | `PreToolUse` | 写 `~/.claude/settings.json`，幂等检测避免误删 |
| **Cursor** | `beforeShellExecution` + `afterFileEdit` | 写 `~/.cursor/hooks.json` |
| **Codex CLI** | `PreToolUse` | 需 `[features] hooks = true`；按 `config.toml.agentcfg-meta` 精确还原 |
| **OpenCode** | `tool.execute.before` + `file.edited` | 复制 TypeScript 插件到 `.opencode/plugins/agentcfg.ts` |

## 技术栈

- **运行时**：Node.js ≥ 18（`engines.node`，仅使用 ESM 模块）
- **模块系统**：ESM（`package.json` 中 `"type": "module"`）
- **依赖**：**零外部 npm 依赖**（所有能力使用 Node 内置 `fs` / `path` / `child_process` / `crypto`）
- **版本控制**：[Git](https://git-scm.com/)（hook 自调用时不再次触发 hook；`--no-verify --no-gpg-sign`）
- **CLI 入口**：`bin/agentcfg.js`
- **跨平台**：Windows / Linux（所有 git 命令通过 `execFileSync` + 数组参数防注入）
- **AI Agent hook 适配**：Claude Code `PreToolUse`、Cursor `beforeShellExecution` + `afterFileEdit`、Codex CLI `PreToolUse`、OpenCode `tool.execute.before` + `file.edited`

## 快速开始

### 环境要求

- Node.js ≥ 18
- Git
- 至少一个 AI 配置目录：`~/.claude` / `~/.cursor` / `~/.codex`，或项目级 `.opencode/`

### 安装

```bash
# 1. 全局安装
npm install -g agentcfg

# 2. 在你的 AI 配置目录初始化
agentcfg init
# 检测到 2 个 agent:
#   claude: C:\Users\xxx\.claude
#   codex:  C:\Users\xxx\.codex
# ✅ 全部 agent 已安装 agentcfg
```

### 命令一览

```bash
agentcfg init                # 安装到当前 Agent 环境
agentcfg verify              # 一键验证：.git / .gitignore / commit / hook / SKILL.md
agentcfg verify --uninstall  # 预览卸载影响（dry-run）
agentcfg status              # 各 agent 工作区状态
agentcfg log [file]          # 查看历史（默认最近 10 条）
agentcfg diff <file> <hash>  # 生成三段式比对报告
agentcfg recover [file] [hash]  # 对话式恢复引导
agentcfg squash [--days N] [--force]  # 压缩 N 天前的 commit（默认 90）
agentcfg ui [--port 3000] [--host 127.0.0.1] [--open]  # 启动 WebUI 仪表板
agentcfg uninstall           # 卸载
```

每个命令支持 `--help` 查看详细用法。

### WebUI 仪表板(可选)

```bash
cd ~/.claude       # 或任意 agentcfg 已 init 的目录
agentcfg ui        # 默认 127.0.0.1:3000
agentcfg ui --port 8080 --open   # 自定义端口 + 自动开浏览器
```

打开 `http://127.0.0.1:3000` 看到**真实备份的全生命周期追踪历史**:

## 关键特性

- **自动备份**：hook 监听 AI 的 `PreToolUse` / `beforeShellExecution` / `afterFileEdit` 等事件，**修改前**自动 `git commit` 留痕。
- **多 agent 支持**：一个 `init` 扫描 `~/.claude` / `~/.cursor` / `~/.codex` 和项目级 `.opencode/`，每个目录独立 git 仓库。
- **三段式比对恢复**：从历史里挑出哪些内容回到当前文件是**判断**，不是操作；agentcfg 生成 `+ 新增 / - 已移除 / = 共有` 报告，由 AI agent 用 Edit 精确写入，**不暴力覆盖**。
- **安全注入防护**：所有 git 命令走 `execFileSync`，参数以数组形式传子进程，配置内容里的任何字符都不会被解释成命令。
- **配置保护**：提交前 `JSON.parse` 校验 `settings.json` 合法性；卸载时按 `config.toml.agentcfg-meta` 元数据精确还原 Codex 原值；squash 前 `git branch -f backup-before-squash` 兜底。
- **增量卸载**：`claude.js` uninstall 用 `filter` 移除 agentcfg 条目而非 `cp` 覆盖整文件，用户的其他配置一字不动。
- **90 天自动压缩**：默认按 tag 豁免 + 临时分支 + rebase `--onto` 合并过期 commit，带回滚分支。
- **零外部依赖**：仅使用 Node 内置模块，npm 包体积小、安装快。
- **WebUI 仪表板**:`agentcfg ui` 一行命令启动浏览器看备份历史(走势图 / 排行榜 / 时间线 / diff 高亮);Node 内置 `http` server,3 个 GET API + 静态 serve;零运行时依赖。

## 对话式恢复（核心场景）

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
> Agent：（用 Edit 精确写入，不覆盖整文件）

三个禁止：
1. 不会使用 `git checkout` 直接覆盖文件
2. 不会使用 `cp` 覆盖整文件
3. 即使文件被删除，也先查 `git log` 确认是否存在过

详细流程见 [`SKILL.md`](SKILL.md)

## 卸载

```bash
# 预览（推荐）
agentcfg verify --uninstall

# 实际卸载
agentcfg uninstall

# 卸载完成后必须重启 AI 会话（Cursor / Claude Code 等）使卸载生效
```

详细手动清理步骤见 [`UNINSTALL.md`](UNINSTALL.md)。

## Contributing

- 报告 bug / 提需求：[GitHub Issues](../../issues)

## License

[MIT](LICENSE) — Copyright (c) 2026 agentcfg contributors
