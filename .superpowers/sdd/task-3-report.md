# Task 3 Report: Core commit.js

## Status: DONE

## Summary
Created and tested `src/core/commit.js`, the core hook commit script.

## Files
- **Created**: `src/core/commit.js` — auto-snapshot commit function with `commit({ cwd, source, toolName })` interface

## Implementation Details
- The function checks if the target directory exists
- Checks if `.git` directory exists
- Runs `git status --porcelain` to detect uncommitted changes
- If changes exist: `git add .` + `git commit --no-verify --no-gpg-sign`
- Commit message format: `auto: snapshot before ${toolName} at ${timestamp}`

## Test Results (9/9 passed)

| Test | Description | Assertions | Result |
|------|-------------|-----------|--------|
| 1 | 有变更时能正确提交 | committed=true, message格式正确, 提交后工作区干净 | 3/3 PASS |
| 2 | 无变更时跳过 | committed=false, 正确跳过消息 | 2/2 PASS |
| 3 | 无 .git 目录时跳过 | committed=false, 正确跳过消息 | 2/2 PASS |
| 4 | 目录不存在时跳过 | committed=false, 正确跳过消息 | 2/2 PASS |

## Edge Cases Covered
- Non-existent working directory
- Missing `.git` directory
- Clean working tree (no changes)
- Fresh file changes (add + commit)
- Temporary directories cleaned up after testing
