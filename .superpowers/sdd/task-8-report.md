# Task 8: Claude Code hook 适配器

## 状态: DONE

## 完成项

- [x] 创建 `src/hooks/claude.js` — 实现 `installClaudeHooks` 和 `uninstallClaudeHooks` 接口
- [x] 创建 `src/hooks/claude.test.js` — 6 个测试用例，覆盖安装、幂等跳过、备份恢复卸载、无备份剥离卸载、文件不存在场景
- [x] 全部测试通过 (17 passed, 0 failed)
- [x] Git commit: `09e7ab5` — `feat: implement Claude Code hook adapter`

## 文件

- `C:\Users\admin\config-mgr\src\hooks\claude.js`
- `C:\Users\admin\config-mgr\src\hooks\claude.test.js`
- `C:\Users\admin\config-mgr\templates\hooks-claude.json` (已有模板)

## 测试覆盖

| # | 场景 | 断言 |
|---|------|------|
| 1 | 安装成功 | installed=true, 消息正确, PreToolUse 存在, 备份文件存在 |
| 2 | 重复安装幂等 | installed=false, 跳过消息 |
| 3 | 卸载从备份恢复 | uninstalled=true, 恢复消息, hooks 已被移除 |
| 4 | 无备份时卸载剥离 | uninstalled=true, 移除消息, hooks 已被过滤 |
| 5 | settings.json 不存在时安装 | installed=false, 错误消息 |
| 6 | settings.json 不存在时卸载 | uninstalled=false, 错误消息 |
