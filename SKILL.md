# agentcfg：AI 工具配置文件版本控制

## 0. 这是什么

agentcfg 是一个基于 Git 的版本控制系统，专门管理你的 AI 工具配置文件。

**它能做什么：**
- 每次修改配置文件前自动备份（通过 hooks）
- 查看任意文件的修改历史
- 恢复旧版本，但不会暴力覆盖

**它管理什么：**
- `__AGENT_DIR__/` 目录下的所有配置文件
- 自动排除缓存、会话等临时文件

---

## 1. 安装后验证

系统正常工作时有以下特征。**推荐直接用 `agentcfg verify` 一键验证**（跨平台）：

```bash
agentcfg verify
```

预期输出（所有项均为 ✅）：
```
claude (C:\Users\xxx\.claude):
  ✅ claude: .git 仓库 — C:\Users\xxx\.claude\.git
  ✅ claude: .gitignore — C:\Users\xxx\.claude\.gitignore
  ✅ claude: 至少 1 个 commit — 5 个 commit（最新: auto: [pre_tool] snapshot before Bash...）
  ✅ claude: hook 注册 — 已注册
  ✅ claude: SKILL.md — C:\Users\xxx\.claude\skills\agentcfg\SKILL.md

✅ 全部检查通过
```

任何 ❌ 都说明安装不完整，请告知用户执行 `agentcfg init` 修复。

如果用户想**手动**验证（不推荐），可分项检查：

### 特征 1：存在 .git 目录

```bash
cd ~/__AGENT_DIR__ && git rev-parse --is-inside-work-tree
```

预期输出：`true`（说明目录是 git 仓库）

> 跨平台说明：`git` 命令在 Windows / macOS / Linux 均原生支持。Unix 风格 `ls -d` / `cat` 在 Windows cmd 不存在，所以**手动检查统一用 `git` 原生命令**。

### 特征 2：存在 .gitignore

```bash
cd ~/__AGENT_DIR__ && git ls-files .gitignore
```

预期输出：`.gitignore`（说明已追踪）

### 特征 3：有 git 提交记录

```bash
cd ~/__AGENT_DIR__ && git log --oneline
```

预期输出：至少有一条 commit，如 `init: 初始配置快照`

---

## 2. 查看修改历史

### 2.1 查看所有文件的历史

当用户问"改过什么"时：

```bash
cd ~/__AGENT_DIR__ && git log --oneline --max-count=15
```

预期输出：
```
a1b2c3d auto: snapshot before Bash at 2026-07-07 15:30:00
e4f5g6h auto: snapshot before Read at 2026-07-05 09:00:00
```

如果输出是空的（只有 commit hash 和 message）→ 正常。
如果输出是 `fatal: not a git repository` → 跳到故障排查 5.1。
如果输出为空 → 跳到故障排查 5.2。

### 2.2 查看某个文件的历史

当用户问"CLAUDE.md 改过什么"时：

```bash
cd ~/__AGENT_DIR__ && git log --oneline --max-count=10 -- CLAUDE.md
```

### 2.3 查看某段时间内的历史

当用户问"这周改了什么"时：

```bash
cd ~/__AGENT_DIR__ && git log --oneline --since="7 days ago"
```

### 2.4 查看历史中的具体变更内容

当用户问"某次 commit 改了啥"时：

```bash
cd ~/__AGENT_DIR__ && git diff <commit-hash>^..<commit-hash>
```

或者查看某个文件在某个版本的具体内容：

```bash
cd ~/__AGENT_DIR__ && git show <commit-hash>:CLAUDE.md
```

---

## 3. 恢复旧版本（标准流程）

> **三条铁律：**
> 1. 禁止使用 `git checkout` 直接覆盖文件
> 2. 禁止使用 `cp` 覆盖整文件
> 3. 即使文件被删除，也先查 `git log` 确认是否存在过

> **重要：`agentcfg recover` 是只读操作**
> - `recover` **只生成报告**（三段式 diff / 历史列表），**不会写入任何文件**
> - 实际恢复必须由 LLM 用 Edit 工具精确写入（不覆盖整文件）
> - 所有恢复路径天然 dry-run，无需 `--dry-run` 标志
> - 这意味着误调 `recover` 不会损坏配置——它只是查询

### 3.0 一键验证安装

当用户问"备份正常吗"或"agentcfg 可用吗"时，**优先用 `agentcfg verify` 一键检查**：

```bash
agentcfg verify
```

输出格式：
```
claude (C:\Users\xxx\.claude):
  ✅ claude: .git 仓库 — C:\Users\xxx\.claude\.git
  ✅ claude: .gitignore — C:\Users\xxx\.claude\.gitignore
  ✅ claude: 至少 1 个 commit — 5 个 commit（最新: auto: [pre_tool] snapshot before Bash...）
  ✅ claude: hook 注册 — 已注册
  ✅ claude: SKILL.md — C:\Users\xxx\.claude\skills\agentcfg\SKILL.md

✅ 全部检查通过
```

任何 ❌ 都提示用户重新执行 `agentcfg init` 或查看 5.3 节故障排查。

### 3.1 三步恢复法

当用户说"帮我恢复"时，按以下步骤执行：

**步骤 1：查历史**

```bash
cd ~/__AGENT_DIR__ && git log --oneline -- <用户指定的文件>
```

在输出中找到目标 commit，向用户确认：
```
找到以下历史版本，请问是哪个？
1. [a1b2c3d] 2026-07-07 15:30:00 — auto: snapshot before Bash
2. [e4f5g6h] 2026-07-05 09:00:00 — auto: snapshot before Read
```

**步骤 2：双读比对**

```bash
# 读取备份版本
git show <commit-hash>:<文件路径>

# 读取当前版本
cat <文件路径>          # macOS / Linux
# Windows PowerShell：Get-Content <文件路径>
```

**步骤 3：输出三段式报告**

```
┌────────────────────────────────────────
│ 恢复比对报告
├─ Commit: a1b2c3d (2026-07-07 15:30:00)
├─ 文件: __AGENT_DIR__/CLAUDE.md
│
├─ + 新增内容（备份有、当前无）:
│   [被删除的规则块]
│
├─ - 已移除内容（当前有、备份无）:
│   [后来新增的规则，不会因恢复而丢失]
│
├─ = 共有内容（两方一致）:
│   [未变动的部分]
└────────────────────────────────────────
```

询问用户：
```
请选择恢复策略：
1. 仅恢复"新增内容"（合并备份中有、当前无的部分）
2. 我想看详细的 diff
3. 我自己手动指定怎么合并
```

### 3.2 常见场景

**场景 A：用户说"帮我把前天改的找回来"**

```bash
cd ~/__AGENT_DIR__ && git log --oneline --after="2 days ago"
```
从输出中定位目标文件，走三步恢复法。

**场景 B：用户说"把我某段被删的配置恢复"**

```bash
cd ~/__AGENT_DIR__ && git log --oneline -- <文件>
```
找到含有该配置的 commit，用 `git show` 提取旧版本内容，
走三步恢复法中的差异比对。

**场景 C：用户说"看看这周改了什么，不恢复"**

```bash
cd ~/__AGENT_DIR__ && git log --since="7 days ago"
cd ~/__AGENT_DIR__ && git diff HEAD@{7.days.ago} HEAD --stat
```

**场景 D：用户说"回滚到一周前的状态"**

```bash
# 不要直接 git checkout！
# 先展示历史：
cd ~/__AGENT_DIR__ && git log --oneline --since="7 days ago"
# 然后走三步恢复法，由用户选择要恢复的内容
```

---

## 4. 查看系统状态

当用户问"备份正常吗"时，**优先用 `agentcfg status`**（跨平台一键检查）：

```bash
agentcfg status
```

预期输出：每个 agent 一段，✅ 工作区干净 / 或列出未提交变更。

也可直接用 `git` 命令（跨平台）：

```bash
cd ~/__AGENT_DIR__ && git status --short
# 如果输出为空，说明所有文件已归档，状态正常
# 如果有输出，说明有未提交的变更

cd ~/__AGENT_DIR__ && git log --oneline -1
# 查看最后一次备份时间
```

如果用户问"磁盘占用多大"，提示：**agentcfg 不跟踪磁盘占用**（仅是个 git 仓库）。
如需查看可用以下命令：

```bash
# macOS / Linux
du -sh ~/__AGENT_DIR__/.git

# Windows PowerShell
Get-ChildItem ~/__AGENT_DIR__/.git -Recurse | Measure-Object -Property Length -Sum
```

---

## 5. 故障排查

### 5.1 git 命令报 "fatal: not a git repository"

**原因：** agentcfg 未初始化或 .git 目录被误删。

**解决：**
```bash
# 执行安装命令
agentcfg init
```
然后告知用户："agentcfg 已重新初始化，首次 commit 已创建。"

### 5.2 git log 什么都看不到

**原因：** 有新文件但没有被 git 追踪，或者 hooks 未正常工作。

**排查：**
```bash
cd ~/__AGENT_DIR__ && git status --short
```

如果输出显示有文件未被追踪：
```bash
cd ~/__AGENT_DIR__ && git add . && git commit -m "manual: 手动归档未追踪文件"
```

如果 status 输出为空但 log 也无内容，说明仓库是全新的，
尚未有任何修改被记录——正常现象。

### 5.3 hooks 没有自动备份

**表现：** 修改了文件但 git log 没有新 commit。

**排查步骤：**

1. **先用 `agentcfg verify` 一键检查 hook 是否注册**：

```bash
agentcfg verify
```

检查项含"hook 注册"和"feature flag"（Codex），如显示 ❌ 说明配置缺失。

2. 如果 hook 缺失：
```bash
agentcfg init
```

3. 如果 hook 注册了但不触发，**99% 是 `process.cwd()` 找不到 .git**：
   - 检查 settings.json 中 hook 命令是否带 `--dir` 参数（v0.1.8+ 自动注入，旧版本需手动重装）
   - 旧版表现：Edit/Write/Bash 都不触发 commit.js，或触发了但 message 是"不是 git 仓库"
   - 解决：执行 `agentcfg init` 重新安装（会自动注入 `--dir` 参数）

4. 如果 commit.js 路径不对，检查：
```bash
# 检查 settings.json 中的 path 是否指向真实存在的文件（跨平台）
node -e "import('fs').then(({existsSync}) => console.log(existsSync('<commit-script-path>')))"
# 或 Git Bash / macOS / Linux：
ls -la <commit-script-path>
```

### 5.4 squash 后找不到旧版本

**表现：** 90 天前的 commit 找不到了。

**原因：** 系统按设计自动压缩了超过 90 天的历史。
`agentcfg squash` 每月 1-3 号执行一次，连续触发确保至少命中一次开机日。

**告知用户：**
```
agentcfg 会自动压缩 90 天前的 commit 以保持历史整洁。
原始内容没有丢失，只是多个 commit 合并成了一个 archive commit。

如需长期保留某个版本，请告知用户：
  git tag 重要版本-2026-07-01 <commit-hash>
打了 tag 的版本不会被压缩。
```

**手动触发 squash（仅调试用）：**
```bash
agentcfg squash           # 使用默认 90 天阈值
agentcfg squash --days 30 # 自定义阈值
```

---

## 6. 重要提醒

- **不要手动删除 .git 目录**，否则丢失所有历史
- **不要手动 git checkout 覆盖文件**，走三步恢复法
- **如果修改了 settings.json 导致 hooks 不生效**，重新执行 `agentcfg init`
- **如需长期保留关键版本**，告知 LLM 对某个 commit 打 tag
- 系统按设计每月 1-3 号自动压缩 90 天前的 commit（详见 `agentcfg squash`）

---

## 7. 架构说明（给高级用户）

### 7.1 为什么 agentcfg 不打包成 plugin？

调研发现各 AI 工具的 hook 挂载机制不一致：

| 工具 | Plugin/Marketplace 机制 | Hook 声明位置 |
|------|-------------------------|---------------|
| Claude Code | ✅ 有 `extraKnownMarketplaces` + `enabledPlugins` | plugin.json 内 `hooks` 字段（[官方文档](https://code.claude.com/docs/en/plugins-reference)） |
| Cursor | ❌ 无 marketplace 概念 | 仅 `.cursor/hooks.json` |
| Codex CLI | ⚠️ 已知 bug：plugin manifest 定义的 hooks 不被加载（[issue #16430](https://github.com/openai/codex/issues/16430)） | 仅 `~/.codex/hooks.json` |
| OpenCode | ✅ 有 plugin 系统 | `.opencode/plugins/*.ts` |

4 个 agent 中只有 1 个支持 plugin 声明 hook（Claude Code），其他 3 个必须直接写 hook 配置文件。**为了跨 agent 一致性，agentcfg 选择统一的"硬编码 + 增量卸载"方案**，卸载时通过 `enabledPlugins.xxx = false` 等效操作清理。

如未来 Claude Code plugin 机制更成熟，可考虑为 Claude 单独提供 plugin 打包方式。

### 7.2 卸载为什么不是"配置项开关"？

理论上 Claude Code 的 `enabledPlugins: { "agentcfg@xxx": false }` 即可禁用。但：
- Cursor / Codex / OpenCode 都没有"插件开关"机制
- 即使 Claude 用了 plugin 机制，其他 3 个仍需"硬卸载"
- 当前 `agentcfg uninstall` 已实现"一个命令卸载所有"，对用户体验无差异

### 7.3 为什么无法自动验证"AI 工具内部缓存"？

AI 工具（Claude Code / Cursor 等）启动时会缓存已注册的 hook、skill、plugin 列表。卸载配置文件后，**必须重启 AI 工具会话** 才能清空缓存。
- Claude Code 无 CLI 暴露"列出当前已注册 hook/skill"
- `agentcfg verify` 只能检查**文件层面**状态，无法检查**进程内缓存**状态

这是 AI 工具的设计限制，agentcfg 无法绕过。请始终遵循 `UNINSTALL.md` 中的"重启 AI 工具会话"步骤。
