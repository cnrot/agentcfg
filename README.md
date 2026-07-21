# agents-cfgit

> AI 编程 Agent 工具的配置文件版本控制 —— 每次修改前自动备份，对话式恢复。

[![npm version](https://img.shields.io/npm/v/agents-cfgit.svg)](https://www.npmjs.com/package/agents-cfgit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-221%20passing-brightgreen.svg)](#testing)

你花几周打磨的 `CLAUDE.md`、`SKILL.md`、agent 配置、核心资产。如果发生误改、误删，几天心血归零。

`agents-cfgit` 把这些配置变成 Git 仓库，每次修改前自动 `git commit` 留痕；恢复时通过对话让 AI 给出三段式比对报告，**精准合并，非暴力覆盖**。

## 介绍

`agents-cfgit`是一个基于 Git 的版本控制工具，专门管理 AI 编程 Agent（Claude Code / Cursor / Codex CLI / OpenCode）的配置文件。每次配置文件被修改前，hooks 自动触发 `git commit` 创建快照；用户通过对话式 [`SKILL.md`](SKILL.md)  AI agent 完成历史查看与三段式比对恢复。

### 为什么需要 agents-cfgit

| 对比 | 手动 `git init` | agents-cfgit |
|---|---|---|
| 自动备份（修改前 commit） | 写 hook | ✅ 内置 |
| 每个 AI 工具目录各自独立仓库 | 手动建 + 维护 | ✅ 自动检测 |
| 卸载时还原原始配置 | 自己记 / 备份 settings.json | ✅ 按原始值精确还原 |
| 损坏的 settings.json | 手动修 | ✅ 校验 + 保护后续编辑 |
| 90 天前的 commit 自动压缩 | 写脚本 | ✅ `agents-cfgit squash` |
| 跨平台（Win/Linux） | 各写一份 | ✅ `execFileSync` 防注入 |
| AI 帮你恢复 | 自己读 git log | ✅ `SKILL.md` 引导对话式恢复 |

### 支持的 AI 工具

| 工具 | hook 事件 | 备注 |
|---|---|---|
| **Claude Code** | `PreToolUse` | 写 `~/.claude/settings.json`，幂等检测避免误删 |
| **Cursor** | `beforeShellExecution` + `afterFileEdit` | 写 `~/.cursor/hooks.json` |
| **Codex CLI** | `PreToolUse` | 需 `[features] hooks = true`；按 `config.toml.agents-cfgit-meta` 精确还原 |
| **OpenCode** | `tool.execute.before` + `file.edited` | 复制 TypeScript 插件到 `.opencode/plugins/agents-cfgit.ts` |

## 技术栈

- **运行时**：Node.js ≥ 18（`engines.node`，仅使用 ESM 模块）
- **模块系统**：ESM（`package.json` 中 `"type": "module"`）
- **依赖**：**零外部 npm 依赖**（所有能力使用 Node 内置 `fs` / `path` / `child_process` / `crypto`）
- **版本控制**：[Git](https://git-scm.com/)（hook 自调用时不再次触发 hook；`--no-verify --no-gpg-sign`）
- **CLI 入口**：`bin/agents-cfgit.js`
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
npm install -g agents-cfgit

# 2. 在你的 AI 工具配置目录初始化
agents-cfgit init
# 检测到 2 个 agent:
#   claude: C:\Users\xxx\.claude
#   codex:  C:\Users\xxx\.codex
# ✅ 全部 agent 已安装 agents-cfgit
```

### 验证

```bash
agents-cfgit verify
# claude (C:\Users\xxx\.claude):
#   ✅ claude: .git 仓库
#   ✅ claude: .gitignore
#   ✅ claude: 至少 1 个 commit
#   ✅ claude: hook 注册
#   ✅ claude: SKILL.md
# ✅ 全部检查通过
```

### 命令一览

```bash
agents-cfgit init                # 安装到当前 AI 工具环境
agents-cfgit verify              # 一键验证：.git / .gitignore / commit / hook / SKILL.md
agents-cfgit verify --uninstall  # 预览卸载影响（dry-run）
agents-cfgit status              # 各 agent 工作区状态
agents-cfgit log [file]          # 查看历史（默认最近 10 条）
agents-cfgit diff <file> <hash>  # 生成三段式比对报告
agents-cfgit recover [file] [hash]  # 对话式恢复引导
agents-cfgit squash [--days N] [--force]  # 压缩 N 天前的 commit（默认 90）
agents-cfgit ui [--port 3000] [--host 127.0.0.1] [--open]  # 启动 WebUI 仪表板
agents-cfgit uninstall           # 卸载
```

每个命令支持 `--help` 查看详细用法。

### WebUI 仪表板(可选)

```bash
cd ~/.claude       # 或任意 agents-cfgit 已 init 的目录
agents-cfgit ui        # 默认 127.0.0.1:3000
agents-cfgit ui --port 8080 --open   # 自定义端口 + 自动开浏览器
```

打开 `http://127.0.0.1:3000` 看到**真实备份历史**:

## 功能特性

- **自动备份**：每次 AI 工具执行操作前，自动把 agent 配置存个档。
- **多工具支持**：不管用的是哪个 AI 编程工具，每个工具的配置各自独立保存，各记各的，互不干扰。
- **精准恢复**：找到历史版本后，它会把"多了什么、少了什么、哪些没变"清楚列出来，你想恢复哪段就恢复哪段，不整文件暴力覆盖。
- **安全防注入**：配置文件内容再怎么奇奇怪怪，也不会被当成命令执行，安全有保障。
- **配置保护**：配置文件有问题时不会盲目提交或覆盖，防止你的其他配置被误伤。
- **干净卸载**：卸载时只摘掉它自己写进去的东西，其他设置一字不动，不留垃圾文件。
- **自动瘦身**：时间久了历史记录自动压缩，省空间但不丢数据。
- **开箱即用**：不需要装额外的东西，装好就能用，体积小。
- **可视化仪表板**：想看看备份历史长啥样？一行命令开个网页，走势图、排行榜、时间线、差异对比都有。

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
> Agent：（用 Edit 工具精确写入，不覆盖整文件）

三个禁止：
1. 不会使用 `git checkout` 直接覆盖文件
2. 不会使用 `cp` 覆盖整个文件
3. 即使文件被删除，也先查 `git log` 确认是否存在过

详细流程见 [`SKILL.md`](SKILL.md)

## 卸载

```bash
# 预览（推荐）
agents-cfgit verify --uninstall

# 实际卸载
agents-cfgit uninstall

# 卸载完成后必须重启 AI 工具会话（Cursor / Claude Code 等）使卸载生效
```

详细手动清理步骤见 [`UNINSTALL.md`](UNINSTALL.md)。

## Contributing

- 报告 bug / 提需求：[GitHub Issues](../../issues)

## License

[MIT](LICENSE) — Copyright (c) 2026 agents-cfgit contributors
