# Task 14: 卸载入口 uninstall.js

**状态**: DONE

## 变更内容

### 新建文件
- `src/uninstall.js` — 卸载入口模块，default export `uninstall()` async function

### 功能说明

遍历所有已注册的 AI 工具（Claude Code、Cursor、Codex CLI、OpenCode），对存在的配置目录依次执行对应的 `uninstall*Hooks()` 卸载逻辑：

1. **Claude Code** — 恢复 `settings.json` 备份
2. **Cursor** — 从 `hooks.json` 移除 config-mgr 条目
3. **Codex CLI** — 从 `hooks.json` 移除 config-mgr 条目
4. **OpenCode** — 删除 `plugins/config-mgr.ts` 插件文件并创建 `.bak` 备份

### Lint 修正

- 移除未使用的 `dirname` import
- 在 `async uninstall()` 内部对 `agent.fn()` 和 `uninstallOpencodeHooks()` 调用添加 `await`（兼容未来异步实现）

### 验证

```
$ node bin/config-mgr.js uninstall
Uninstalling config-mgr...

  Claude Code: 已从备份恢复 settings.json

Warning: .git repos in agent directories are NOT removed automatically.
  If you want to remove them, run:
    trash ~/.claude/.git
    trash ~/.cursor/.git
    trash ~/.codex/.git
```

### 提交

```
5dc3933 feat: implement uninstall entry point
```
