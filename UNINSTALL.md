# 卸载 config-mgr

## 自动卸载

```bash
npx @config-mgr/cli uninstall
```

自动完成：
- Claude Code：从 settings.json 移除 hooks（有备份）
- Cursor：移除 hooks.json（有备份）
- Codex CLI：移除 hooks.json + 关闭 feature flag
- OpenCode：删除插件文件（有备份）
- 各技能目录的 SKILL.md 会保留或询问后删除

## 手动清理

如果自动卸载不完全，手动执行：

### Claude Code
编辑 `~/.claude/settings.json`，删除 `hooks` 块。

### Cursor
删除 `.cursor/hooks.json`。

### Codex CLI
删除 `~/.codex/hooks.json`，
编辑 `~/.codex/config.toml` 将 `hooks = true` 改为 `hooks = false`。

### OpenCode
删除 `.opencode/plugins/config-mgr.ts`。

### Git 仓库
```bash
rm -rf ~/.claude/.git
rm -rf ~/.cursor/.git
rm -rf ~/.codex/.git
```

## 备份恢复

如果卸载后反悔了：
- settings.json 备份位于 `~/.claude/settings.json.bak.config-mgr`
- .git 仓库不主动删除，可以重新 `npx @config-mgr/cli init`
