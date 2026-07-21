# 卸载 agents-cfgit

## 卸载前预览（推荐）

```bash
agents-cfgit verify --uninstall
```

输出每个 agent 将被清理/还原的项，**不会实际修改任何文件**。确认无误后再执行实际卸载。

## 自动卸载

```bash
agents-cfgit uninstall
```

自动完成：
- Claude Code：从 settings.json 移除 agents-cfgit 的 hook 条目 + `enabledPlugins` 中 agents-cfgit 条目 + `extraKnownMarketplaces` 中 agents-cfgit 源（有备份）
- Cursor：移除 hooks.json（有备份）
- Codex CLI：移除 hooks.json + 按 `config.toml.agents-cfgit-meta` 元数据还原原始 hooks 值
- OpenCode：删除插件文件（有备份）
- 各技能目录的 SKILL.md 会保留或询问后删除

### ⚠️ 重要：重启 AI 工具会话

卸载完成后 **必须重启 AI 工具会话** 才能使卸载生效：
- **Claude Code**：关闭当前对话并重新打开（或执行 `claude` 重新启动）
- **Cursor**：重启 Cursor 应用
- **Codex CLI**：关闭并重开 Codex
- **OpenCode**：重启 OpenCode

AI 工具会在启动时重新加载配置文件并扫描已注册插件。未重启可能导致残留 hook 仍被触发。

### 验证卸载

```bash
agents-cfgit verify
```

预期输出所有检查项均为 ❌（表示 agents-cfgit 不再存在）。如仍显示 ✅，说明文件未被完全清理，需手动处理。

### 清理 npm 全局包装器

```bash
# 卸载全局包
npm uninstall -g agents-cfgit

# 手动清理残留的 CLI 包装器（Windows）
trash "$(npm root -g)/../bin/agents-cfgit"
trash "$(npm root -g)/../bin/agents-cfgit.cmd"
trash "$(npm root -g)/../bin/agents-cfgit.ps1"
```

## 手动清理

如果自动卸载不完全，手动执行：

### Claude Code
编辑 `~/.claude/settings.json`：
1. 找到 `hooks.PreToolUse` 数组中 command 包含 `commit.js` 的条目并删除（**不要删除整个 hooks 块**）
2. 找到 `enabledPlugins` 对象中 key 含 "agents-cfgit" 的条目并删除
3. 找到 `extraKnownMarketplaces` 数组中 source 含 "agents-cfgit" 的条目并删除

### Cursor
删除 `.cursor/hooks.json`。

### Codex CLI
删除 `~/.codex/hooks.json`，
编辑 `~/.codex/config.toml` 按原始 `config.toml.agents-cfgit-meta` 还原 hooks 值（或设为 `hooks = false`）。

### OpenCode
删除 `.opencode/plugins/agents-cfgit.ts`。

### Git 仓库

> `trash` 命令在 Windows / macOS / Linux 都支持（Windows 通过 npm 全局安装）。如果尚未安装：
> - macOS: `brew install trash`
> - Windows / Linux: `npm install -g trash-cli`

```bash
# 跨平台（需要 trash-cli）
trash ~/.claude/.git
trash ~/.cursor/.git
trash ~/.codex/.git

# Windows 原生（不用 trash）—— 移入回收站
Remove-Item -Recurse -Force ~/.claude/.git
```

## 备份恢复

如果卸载后反悔了：
- settings.json 备份位于 `~/.claude/settings.json.bak.agents-cfgit`
- .git 仓库不主动删除，可以重新 `agents-cfgit init`

