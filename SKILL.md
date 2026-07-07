# agentcfg：AI 工具配置文件版本控制

## 0. 这是什么

agentcfg 是一个基于 Git 的版本控制系统，专门管理你的 AI 工具配置文件。

**它能做什么：**
- 每次修改配置文件前自动备份（通过 hooks）
- 查看任意文件的修改历史
- 恢复旧版本，但不会暴力覆盖

**它管理什么：**
- `.claude/` 目录下的所有配置文件
- 自动排除缓存、会话等临时文件

---

## 1. 安装后验证

系统正常工作时有以下特征：

### 特征 1：存在 .git 目录

```bash
ls -d .claude/.git
```
预期输出：`.claude/.git` 存在

### 特征 2：存在 .gitignore

```bash
cat .claude/.gitignore
```
预期输出：包含 `backups/`、`.runtime/` 等排除规则

### 特征 3：有 git 提交记录

```bash
cd .claude && git log --oneline
```
预期输出：至少有一条 commit，如 `init: 初始配置快照`

**如果以上任意特征缺失，请告知用户先执行：**
```bash
npx agentcfg init
```

---

## 2. 查看修改历史

### 2.1 查看所有文件的历史

当用户问"改过什么"时：

```bash
cd .claude && git log --oneline --max-count=15
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
cd .claude && git log --oneline --max-count=10 -- CLAUDE.md
```

### 2.3 查看某段时间内的历史

当用户问"这周改了什么"时：

```bash
cd .claude && git log --oneline --since="7 days ago"
```

### 2.4 查看历史中的具体变更内容

当用户问"某次 commit 改了啥"时：

```bash
cd .claude && git diff <commit-hash>^..<commit-hash>
```

或者查看某个文件在某个版本的具体内容：

```bash
cd .claude && git show <commit-hash>:CLAUDE.md
```

---

## 3. 恢复旧版本（标准流程）

> **三条铁律：**
> 1. 禁止使用 `git checkout` 直接覆盖文件
> 2. 禁止使用 `cp` 覆盖整文件
> 3. 即使文件被删除，也先查 `git log` 确认是否存在过

### 3.1 三步恢复法

当用户说"帮我恢复"时，按以下步骤执行：

**步骤 1：查历史**

```bash
cd .claude && git log --oneline -- <用户指定的文件>
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
cat <文件路径>
```

**步骤 3：输出三段式报告**

```
┌────────────────────────────────────────
│ 恢复比对报告
├─ Commit: a1b2c3d (2026-07-07 15:30:00)
├─ 文件: .claude/CLAUDE.md
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
cd .claude && git log --oneline --after="2 days ago"
```
从输出中定位目标文件，走三步恢复法。

**场景 B：用户说"把我某段被删的配置恢复"**

```bash
cd .claude && git log --oneline -- <文件>
```
找到含有该配置的 commit，用 `git show` 提取旧版本内容，
走三步恢复法中的差异比对。

**场景 C：用户说"看看这周改了什么，不恢复"**

```bash
cd .claude && git log --since="7 days ago"
cd .claude && git diff HEAD@{7.days.ago} HEAD --stat
```

**场景 D：用户说"回滚到一周前的状态"**

```bash
# 不要直接 git checkout！
# 先展示历史：
cd .claude && git log --oneline --since="7 days ago"
# 然后走三步恢复法，由用户选择要恢复的内容
```

---

## 4. 查看系统状态

当用户问"备份正常吗"时：

```bash
cd ~/.claude && git status --short
# 如果输出为空，说明所有文件已归档，状态正常
# 如果有输出，说明有未提交的变更

cd ~/.claude && git log --oneline -1
# 查看最后一次备份时间
```

如果用户问"磁盘占用多大"：

```bash
du -sh ~/.claude/.git
```

---

## 5. 故障排查

### 5.1 git 命令报 "fatal: not a git repository"

**原因：** agentcfg 未初始化或 .git 目录被误删。

**解决：**
```bash
# 执行安装命令
npx agentcfg init
```
然后告知用户："agentcfg 已重新初始化，首次 commit 已创建。"

### 5.2 git log 什么都看不到

**原因：** 有新文件但没有被 git 追踪，或者 hooks 未正常工作。

**排查：**
```bash
cd .claude && git status --short
```

如果输出显示有文件未被追踪：
```bash
cd .claude && git add . && git commit -m "manual: 手动归档未追踪文件"
```

如果 status 输出为空但 log 也无内容，说明仓库是全新的，
尚未有任何修改被记录——正常现象。

### 5.3 hooks 没有自动备份

**表现：** 修改了文件但 git log 没有新 commit。

**排查步骤：**

1. 检查 hook 配置是否存在：
```bash
# Claude Code
cat ~/.claude/settings.json | grep -A 5 "PreToolUse"

# Cursor
cat .cursor/hooks.json 2>/dev/null

# Codex CLI
cat ~/.codex/hooks.json 2>/dev/null
cat ~/.codex/config.toml | grep hooks
```

2. 如果配置缺失：
```bash
npx agentcfg init
```

3. 如果配置存在但不触发，检查 commit.js 路径是否正确：
```bash
# 检查 settings.json 中的 path 是否指向真实存在的文件
ls -la /path/to/commit.js
```

### 5.4 squash 后找不到旧版本

**表现：** 90 天前的 commit 找不到了。

**原因：** 系统自动压缩了超过 90 天的历史。

**告知用户：**
```
agentcfg 会自动压缩 90 天前的 commit 以保持历史整洁。
原始内容没有丢失，只是多个 commit 合并成了一个 archive commit。

如需长期保留某个版本，请告知用户：
  git tag 重要版本-2026-07-01 <commit-hash>
打了 tag 的版本不会被压缩。
```

---

## 6. 重要提醒

- **不要手动删除 .git 目录**，否则丢失所有历史
- **不要手动 git checkout 覆盖文件**，走三步恢复法
- **如果修改了 settings.json 导致 hooks 不生效**，重新执行 `npx agentcfg init`
- **如需长期保留关键版本**，告知 LLM 对某个 commit 打 tag
- 系统每季度自动压缩 90 天前的 commit，不会丢失内容