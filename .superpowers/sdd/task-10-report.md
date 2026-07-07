# Task 10 Report: Codex CLI hook 适配器

## Summary
- **File created**: `src/hooks/codex.js` (逐字符复制自 brief 代码)
- **File created**: `src/hooks/codex.test.js` (5 test cases, 25 assertions)
- **Commit**: `7abb281` on `main`, message: `feat: implement Codex CLI hook adapter with feature flag`

## Test Coverage
| # | Test Case | Assertions |
|---|-----------|-----------|
| 1 | install succeeds and creates hooks.json + config.toml | 10 |
| 2 | re-install is idempotent (skips) | 2 |
| 3 | uninstall removes hooks entries and disables feature | 5 |
| 4 | appends [features] when config.toml exists without it | 4 |
| 5 | creates config.toml when it does not exist | 4 |

**Result**: 25 passed, 0 failed

## Key behaviors verified
- `installCodexHooks()` creates `hooks.json` with PreToolUse hook, templates/hooks-codex.json as source
- Second install with same commit.js path returns `{ installed: false, message: 'Codex hooks 已注册，跳过' }`
- `uninstallCodexHooks()` backs up and filters out commit.js entries from PreToolUse
- config.toml is auto-created with `[features] hooks = true` on install (if missing)
- config.toml without `[features]` gets it appended on install
- On uninstall, `hooks = true` is changed to `hooks = false` in config.toml
