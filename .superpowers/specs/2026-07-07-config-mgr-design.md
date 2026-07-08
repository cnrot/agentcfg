# config-mgr 设计文档

> 基于 Git 的 AI 工具配置文件版本控制系统
> 版本：v1.0-draft
> 创建日期：2026-07-07

---

## 1. 概述

### 1.1 解决什么问题

你花了几周、甚至几个月打磨的 prompt、system prompt、SKILL.md、agent 配置——这些是你的**核心资产**。一次误改、误删，可能让大量心血付诸东流。

AI 编程工具（Claude Code、Cursor、Codex CLI、OpenCode 等）的配置文件在持续修改过程中缺乏版本管理：

- **改前没有自动备份**——LLM 直接覆写，原来的内容去哪了不知道
- **改后无法追溯**——"我记得上周有段配置写得很好，但现在找不回来了"
- **恢复全靠记忆或全量覆盖**——要么凭印象重写，要么把整个配置目录回滚，连带丢失中间所有的增量修改

config-mgr 就是解决这三个问题。

### 1.2 设计目标

1. **自动提交未归档的变更**——hooks 检测到有未提交的改动时，在下一次操作前自动完成 commit，杜绝"忘了提交"的情况
2. **每次备份生成可检索的历史记录**——标准 git log，想查随时查
3. **精准恢复**——比对差异后选择性合并，禁止暴力覆盖
4. **跨平台兼容**——支持主流 AI 编程工具
5. **安装即用**——一个命令完成部署

> 说明：这里的设计和常规 git 工作流没有本质区别。常规开发是"改→add→commit→push"，config-mgr 只是把"commit"这个动作从人工记忆变成了 hooks 自动检测触发。commit 记录的内容仍然是**已经发生的修改**，不存在"改前提交"这种反直觉操作。

### 1.3 核心思路

用 **Git 标准版本控制**做存储引擎，替换之前的 INDEX.md + backups/TIMESTAMP/ 自定义备份方案。Git 的 commit/log/diff/show 全部现成，不需要再造轮子。

---

## 2. 项目结构

```
config-mgr/
├── package.json              # npm 包定义
├── README.md                 # 人类读的：简介、安装、平台支持
├── SKILL.md                  # AI agent 读的：安装指引 + 操作指令集
├── UNINSTALL.md              # 卸载指引
│
├── src/
│   ├── core/                 ★ 核心逻辑，所有 agent 公用
│   │   ├── init.js           git init + .gitignore 写入 + 首次 commit
│   │   ├── commit.js         git add + git commit（hooks 调用入口）
│   │   ├── log.js            git log 格式化输出封装
│   │   ├── diff.js           三段式比对报告生成
│   │   └── squash.js         90 天历史压缩脚本
│   │
│   ├── hooks/                ★ 各 agent 适配器
│   │   ├── claude.js         Claude Code → settings.json
│   │   ├── cursor.js         Cursor → .cursor/hooks.json
│   │   ├── codex.js          Codex CLI → hooks.json + config.toml
│   │   └── opencode.js       OpenCode → .ts plugin 文件
│   │
│   ├── install.js            ★ 安装入口（检测环境 → 识别 agent → 执行）
│   └── recover.js            ★ 恢复入口（查历史 → 比差异 → 输出报告）
│
├── templates/
│   ├── gitignore             .gitignore 模板
│   ├── hooks-claude.json     Claude Code hooks 配置
│   ├── hooks-cursor.json     Cursor hooks 配置
│   ├── hooks-codex.json      Codex CLI hooks 配置
│   └── plugin-opencode.ts    OpenCode 插件模板
│
└── scripts/
    └── squash.sh             90 天压缩脚本（定时任务调用）
```

---

## 3. 支持的 AI 工具

| 工具 | 配置位置 | Hook 机制 | 安装方式 |
|------|---------|-----------|---------|
| Claude Code | `~/.claude/settings.json` | PreToolUse | 注入 hooks 块 |
| Cursor | `.cursor/hooks.json` 或 `~/.cursor/hooks.json` | beforeShellExecution / afterFileEdit | 创建 hooks.json |
| Codex CLI | `~/.codex/hooks.json` + `~/.codex/config.toml` | PreToolUse | 创建 hooks.json + config.toml 开启 feature flag |
| OpenCode | `.opencode/plugins/config-mgr.ts` | 插件生命周期 (`tool.execute.before` / `file.edited`) | 放入 plugins 目录 |

> **重要：** Codex CLI 必须在 `~/.codex/config.toml` 中设置 `[features] hooks = true`，否则 hooks 静默失败。

---

## 4. 安装流程

### 4.1 执行入口

```bash
npx @config-mgr/cli init
```

### 4.2 流程图

```
npx @config-mgr/cli init
         │
  ┌──────▼──────┐
  │ 检测 AI 工具  │ ← 扫描 .claude/ .cursor/ .codex/ .opencode/
  └──────┬──────┘
         │
         ▼
  检测通过？
  ├── 否 → 输出"未检测到支持的 AI 工具"，退出
  └── 是 → 继续
         │
  ┌──────▼──────┐
  │ 检测重复安装  │ ← 每个目标目录独立检测
  └──────┬──────┘
         │
         ▼
  目标目录已安装？
         │
  ├── 已安装 → 逐项检查完整性：
  │   .git 存在？         → 缺则 git init
  │   .gitignore 已写入？   → 缺则写入
  │   hooks 已注册？       → 缺则注册
  │   SKILL.md 已安装？     → 缺则安装
  │   全部完整 → 输出"已安装，配置完整"，退出
  │
  └── 未安装 → 全流程执行：
      1. git init
      2. 写入 .gitignore（从模板复制）
      3. git add . + git commit -m "init: 初始配置快照"
      4. 注册 hooks（调用对应 hooks/{agent}.js）
      5. 安装 SKILL.md 到对应技能目录
      6. 输出安装完成报告（含仓库状态、已注册 hooks、SKILL.md 路径）
```

### 4.3 SKILL.md 安装规则

- 检测到什么 agent 就装什么目录
- Claude Code → `.claude/skills/config-mgr/SKILL.md`
- Cursor → `.cursor/skills/config-mgr/SKILL.md`
- Codex CLI → `.codex/skills/config-mgr/SKILL.md`
- OpenCode → `.opencode/plugins/config-mgr.ts`
- 不存在的 agent 不安装，不存在的目录不创建

### 4.4 重复执行的安全性

`npx @config-mgr/cli init` 可以反复执行，不会破坏现有配置：

- 已安装 → 逐项检测完整性，缺啥补啥
- hooks 写入采用幂等写入，不会重复追加
- SKILL.md 若已存在则跳过覆盖

---

## 5. Hook 自动备份机制

### 5.1 核心 hook 脚本

所有 agent 的 hooks 指向同一个脚本 `src/core/commit.js`：

```bash
node path/to/commit.js --source <触发点> --tool <工具名>
```

### 5.2 commit.js 执行流程

```
commit.js --source pre_tool --tool Bash
  │
  ├── Step 1: 检测是否有未提交改动
  │   git status --porcelain
  │   ├── 无改动 → exit 0（零开销跳过）
  │   └── 有改动 → 继续
  │
  ├── Step 2: 过滤干扰改动
  │   如果改动只涉及 .gitignore 排除的文件 → exit 0
  │   如果改动涉及被追踪的文件 → 继续
  │
  ├── Step 3: git add .
  │
  └── Step 4: git commit
      git commit -m "auto: snapshot before {tool} at {timestamp}"
      （自动跳过 git commit 钩子，避免循环触发）
```

### 5.3 各 agent hook 注册格式

**Claude Code（`~/.claude/settings.json`）：**

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "node path/to/commit.js --source pre_tool",
          "statusMessage": "config-mgr: 检测配置文件变更"
        }
      ]
    }
  ]
}
```

**Cursor（`.cursor/hooks.json`）：**

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "node path/to/commit.js --source pre_shell"
      }
    ],
    "afterFileEdit": [
      {
        "command": "node path/to/commit.js --source post_edit"
      }
    ]
  }
}
```

**Codex CLI（`~/.codex/hooks.json` + `~/.codex/config.toml`）：**

```toml
# ~/.codex/config.toml — 此文件必须开启，否则 hooks 静默失效
[features]
hooks = true
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node path/to/commit.js --source pre_tool",
            "statusMessage": "config-mgr: snapshotting"
          }
        ]
      }
    ]
  }
}
```

**OpenCode（`.opencode/plugins/config-mgr.ts`，目标目录按实际检测到的路径动态生成）：**

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const ConfigMgrPlugin: Plugin = async (ctx) => {
  const targetDir = ctx.project.worktree || ctx.directory
  return {
    'tool.execute.before': async ({ tool }) => {
      await ctx.$`cd ${targetDir} && git add . && git diff --cached --quiet || git commit -m "auto: snapshot before ${tool}"`
    },
    'file.edited': async ({ filePath }) => {
      if (filePath.includes('.opencode')) {
        await ctx.$`cd ${targetDir} && git add . && git diff --cached --quiet || git commit -m "auto: snapshot after edit ${filePath}"`
      }
    }
  }
}
```

---

## 6. .gitignore 配置

```gitignore
# 旧备份体系（废弃）
backups/

# 运行时缓存
.runtime/
file-history/
shell-snapshots/

# 会话缓存
sessions/
session-env/

# 插件缓存
plugins/cache/

# 临时文件
stats-cache.json
desktop-server-state.json
*.bak.*
```

---

## 7. 历史保留与压缩

### 7.1 策略

- **自动归档**：hooks 自动检测未提交的变更，在下次操作前完成 commit。与常规 git 工作流一致（改→add→commit），只是提交动作从"人工记忆"变成了 hooks 自动触发
- **内容永久保留**：90 天内的 commit 以完整粒度保留。超过 90 天的 commit 会被压缩为 archive commit（内容不丢失，只合并提交记录），不会删除任何已保存的数据
- **tag 豁免**：打了 tag 的版本不受 90 天压缩影响，永久保留完整粒度

### 7.2 压缩时机

每月 **1 号、2 号、3 号**中午 12:00 各执行一次，连续触发确保至少命中一次开机日。

### 7.3 压缩脚本逻辑

```
squash.sh（月刊 1-3 号触发）
  │
  ├── 1. 计算 90 天前的精确时间戳（到秒）
  │   cutoff=$(date -d "90 days ago" +%Y-%m-%dT%H:%M:%S)
  │
  ├── 2. 查找超过 90 天的 commit
  │   git log --before="$cutoff" --format="%H" --reverse
  │   ├── 无结果 → exit 0（已压缩过或未满 90 天）
  │   └── 有结果 → 继续
  │
  ├── 3. 检查是否有 tag 需要保留
  │   打了 tag 的 commit 不压缩
  │
  ├── 4. git rebase 压缩
  │   对 90 天前的 commit 执行 rebase，压缩为一个 archive commit
  │   （安全说明：配置文件仓库为单人使用，rebase 不产生协作冲突）
  │
  └── 5. 创建 archive commit
      git commit -m "archive: 历史压缩于 {执行时间戳}"
```

> 安全说明：rebase 只适用于单人维护的仓库。配置文件仓库严格为单人操作，不存在多人协作冲突风险。
> 跨平台说明：该脚本最终会以 Node.js 实现（含跨平台日期计算），确保 Windows/macOS/Linux 一致运行。

### 7.4 幂等性保证

压缩脚本天然幂等：
- 1 号执行了 squash → 2 号检测没有超过 90 天的 commit → 自动跳过
- 1 号没开电脑 → 2 号执行 → 3 号检测跳过
- 连续 3 天都没开 → 下个月 1-3 号再试，最多多保留一个月

---

## 8. 恢复流程

### 8.1 核心原则

- **禁止直接 `git checkout` 覆盖文件**
- **禁止 `cp` 覆盖整文件**
- 恢复必须走比对 → 评估 → 选择性合并流程

### 8.2 标准恢复流程

```
用户要求恢复某个旧版本
  │
  ├── Step 1: 查历史
  │   git log --oneline -- .claude/目标文件
  │   展示最近 N 条记录给用户确认
  │
  ├── Step 2: 双读比对
  │   git show <目标commit>:<文件>  → 读备份版本
  │   cat <当前文件>                 → 读当前版本
  │
  ├── Step 3: 输出三段式比对报告
  │   ┌────────────────────────────────────────
  │   │ 恢复比对报告
  │   ├─ 条目: 目标commit (时间戳)
  │   ├─ 文件: 目标文件路径
  │   │
  │   ├─ + 新增内容（备份有、当前无）:
  │   │   [差异片段]
  │   │
  │   ├─ - 已移除内容（当前有、备份无）:
  │   │   [差异片段]
  │   │
  │   ├─ = 共有内容（两方一致）:
  │   │   [差异片段]
  │   └────────────────────────────────────────
  │
  └── Step 4: 用户决策
      选择：仅恢复新增 / 全量查看差异 / 手动指定合并策略
      LLM 用 Edit 工具精确写入，不覆盖整文件
```

### 8.3 常见恢复场景

| 场景 | LLM 应对 |
|------|---------|
| "帮我把前天改的找回来" | `git log --after="2 days ago"` 筛选目标 |
| "把我某段被删的配置恢复" | 先 `git log` 找到含有该配置的 commit，`git show` 提取该版本 |
| "看看这周改了什么，不恢复" | `git log --since="7 days ago"` + `git diff` 展示 |
| "回滚到一周前的状态" | 拒绝直接回滚，走标准三段式比对流程 |

---

## 9. SKILL.md 指令集

SKILL.md 是给 AI agent 读的操作手册，按技能目录各自安装一份。

### 9.1 设计原则

- **穷举场景**：覆盖所有可能的恢复需求，弱 LLM 直接按场景模板执行
- **每步有示例**：命令行 + 预期输出 + 决策树
- **错误排查**：列出常见故障及其解决步骤

### 9.2 SKILL.md 目录结构

```
0. 这是什么（30 秒理解系统在做什么）
1. 安装后验证（如何确认系统正常工作）
2. 查看历史（用户问"改过什么"时）
   - 2.1 查看所有文件历史
   - 2.2 查看某个文件历史
   - 2.3 查看某段时间内历史
   - 2.4 查看历史中的具体变更内容
3. 恢复旧版本（用户问"帮我找回来"时）
   - 3.1 三步恢复法（标准流程）
   - 3.2 常见恢复场景 A/B/C/D
   - 3.3 恢复三条铁律
4. 查看系统状态（用户问"备份正常吗"时）
5. 故障排查
   - 5.1 "not a git repository"
   - 5.2 git log 无内容
   - 5.3 hooks 没自动备份
   - 5.4 squash 后找不到旧版本
6. 重要提醒
```

---

## 10. 卸载流程

```bash
npx @config-mgr/cli uninstall
  │
  ├── 检测已安装的 agent
  │
  ├── 移除 hooks 配置
  │   Claude Code → 从 settings.json 删除 hooks 块
  │   Cursor → 删除 hooks.json
  │   Codex CLI → 删除 hooks.json + 关闭 feature flag
  │   OpenCode → 删除 plugins/config-mgr.ts
  │
  ├── 移除 SKILL.md
  │   各技能目录下删除 config-mgr/SKILL.md
  │
  ├── 是否删除 .git 仓库？（询问用户）
  │   是 → rm -rf .git
  │   否 → 保留仓库供手动访问
  │
  └── 输出卸载完成报告
```

---

## 11. 与旧备份体系的过渡

安装 config-mgr 后，旧的 `backups/` 目录和 `INDEX.md` 的处理方式：

- `backups/` 被 `.gitignore` 排除，不再追踪
- `INDEX.md` 保留不删，作为只读历史参考
- 旧备份的物理文件不会被 git 管理，但 INDEX.md 中的记录仍然可读
- 用户可自行决定是否删除旧备份目录

---

## 12. 未决事项 / 后续扩展

- **多仓库合并**：检测到多个 agent 目录时，是否合并到一个中心 git 仓库
- **云同步**：可参考游戏存档云端机制（如 Steam 云存档的冲突解决策略），自动 push 到远程仓库（GitHub/GitLab）作为异地备份。核心要素包括：自动同步时机、冲突检测与合并策略、多设备间状态一致性
- **GUI 界面**：可视化查看 commit 历史
- **CLI 完整命令体系**：`config-mgr status/log/diff/restore` 独立命令

---

## 附录 A：各 agent 配置修改风险对照表

| 操作 | Claude Code settings.json | Cursor hooks.json | Codex hooks.json + config.toml | OpenCode plugin |
|------|--------------------------|-------------------|-------------------------------|-----------------|
| 读配置 | JSON 解析 | JSON 解析 | JSON + TOML 解析 | TS 文件解析 |
| 写配置 | 读取→修改 hocks 块→覆盖 | 创建/覆盖文件 | 创建 hooks.json + 读写 config.toml | 创建 .ts 文件 |
| 备份原配置 | 写入前备份 settings.json | 写入前备份 hooks.json | 写入前备份 hooks.json + config.toml | 无需备份 |
| 失败风险 | 低（JSON 结构已知） | 低（独立文件） | 中（两个文件需协调） | 低（独立文件） |
| 恢复 | 还原备份的 settings.json | 还原备份的 hooks.json | 还原备份的两个文件 | 删除插件文件 |

## 附录 B：术语表

| 术语 | 说明 |
|------|------|
| agent | AI 编程工具（Claude Code、Cursor 等） |
| hook | 生命周期钩子，在特定事件触发时执行脚本 |
| commit | git 的一次版本快照 |
| squash | 将多个 commit 压缩为一个 |
| 三段式比对 | 备份内容 vs 当前内容的差异报告（新增/已移除/共有） |
| 幂等 | 同一操作执行多次结果一致，不会产生副作用 |
