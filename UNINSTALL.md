# 卸载 agentcfg

## 自动卸载

```bash
agentcfg uninstall
```

自动完成：
- Claude Code：从 settings.json 移除 agentcfg 的 hook 条目（有备份）
- Cursor：移除 hooks.json（有备份）
- Codex CLI：移除 hooks.json + 关闭 feature flag
- OpenCode：删除插件文件（有备份）
- 各技能目录的 SKILL.md 会保留或询问后删除

### 清理 npm 全局包装器

```bash
# 卸载全局包
npm uninstall -g agentcfg

# 手动清理残留的 CLI 包装器（Windows）
trash "$(npm root -g)/../bin/agentcfg"
trash "$(npm root -g)/../bin/agentcfg.cmd"
trash "$(npm root -g)/../bin/agentcfg.ps1"
```

## 手动清理

如果自动卸载不完全，手动执行：

### Claude Code
编辑 `~/.claude/settings.json`，找到 `hooks.PreToolUse` 数组中 command 包含 `commit.js` 的条目并删除，**不要删除整个 hooks 块**（可能还有其他工具的 hook）。

### Cursor
删除 `.cursor/hooks.json`。

### Codex CLI
删除 `~/.codex/hooks.json`，
编辑 `~/.codex/config.toml` 将 `hooks = true` 改为 `hooks = false`。

### OpenCode
删除 `.opencode/plugins/agentcfg.ts`。

### Git 仓库
```bash
trash ~/.claude/.git
trash ~/.cursor/.git
trash ~/.codex/.git
```

## 备份恢复

如果卸载后反悔了：
- settings.json 备份位于 `~/.claude/settings.json.bak.agentcfg`
- .git 仓库不主动删除，可以重新 `agentcfg init`
