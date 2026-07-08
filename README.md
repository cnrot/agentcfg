# agentcfg

> 基于 Git 的 AI 编程 Agent 工具配置文件版本控制系统。

一句话：**自动备份你的 AI 编程 Agent 工具的核心配置，随时可追溯，精准可恢复。** 本项目完全由 vibe coding 开发的，有问题欢迎 issues

## 痛点

你花了几周、甚至几个月打磨的 prompt、system prompt、SKILL.md、agent 配置 ——
这些是你的核心资产。一次误改、误删，可能让大量心血付诸东流。

## 能力

| 能力 | 说明 |
|------|------|
| 自动备份 | hooks 自动检测修改，下次操作前完成 git commit |
| 历史追溯 | 标准 git log，想看什么查什么 |
| 精准恢复 | 三段式比对报告，选择性合并，不暴力覆盖 |
| 跨平台 | 支持 Windows / macOS / Linux |

## 支持的 AI 工具

- Claude Code
- Cursor
- Codex CLI
- OpenCode

## 安装

```bash
npx agentcfg init
```

安装过程：
1. 检测当前环境中的 Agent 工具
2. 在配置目录初始化 git 仓库
3. 写入 .gitignore 排除临时文件
4. 注册 hooks 实现自动备份
5. 安装 SKILL.md 操作指引

## 恢复

agentcfg 不是通过 CLI 恢复，而是**通过 AI agent 对话恢复**。
安装到各环境的 SKILL.md 会教会 Agent 如何操作。

用户只需说：
- "帮我把前天改的 CLAUDE.md 找回来"
- "看看这周改了什么"
- "把我某段被删的配置恢复"

## 项目结构

```
agentcfg/
├── bin/agentcfg.js       CLI 入口
├── src/core/             git 操作核心
├── src/hooks/            各 agent 适配器
├── templates/            配置模板
├── SKILL.md              AI agent 操作手册
├── README.md
└── UNINSTALL.md
```

## 卸载

```bash
npx agentcfg uninstall
```

如需删除 .git 仓库，手动执行：
```bash
trash ~/.claude/.git
```
