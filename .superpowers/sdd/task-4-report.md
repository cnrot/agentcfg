# Task 4 Report: Core init.js

**Status**: DONE

## Summary

Created `src/core/init.js` implementing the `initGit(cwd)` function and its test suite.

## Files Created

- `C:\Users\admin\config-mgr\src\core\init.js` — Core module with `initGit` export. Initializes a git repo, copies `.gitignore` from templates, stages all files, and creates the first commit.
- `C:\Users\admin\config-mgr\src\core\init.test.js` — Test suite with 5 test cases, 21 assertions.

## Test Results

All 21 assertions passed across 5 test cases:

| Test | Assertions | Result |
|------|-----------|--------|
| 首次初始化成功 | 7 | Passed |
| 重复初始化幂等 | 6 | Passed |
| .gitignore 内容正确 | 1 | Passed |
| 空目录也能初始化 | 2 | Passed |
| 失败时不抛异常 | 5 | Passed |

## Coverage

- **First initialization**: Verifies `.git` and `.gitignore` created, correct return shape, first commit exists with expected message.
- **Idempotency**: Verifies re-initialization returns `skipped: true` and does not corrupt existing repo.
- **Template fidelity**: Verifies `.gitignore` content matches `templates/gitignore` exactly.
- **Edge cases**: Empty directory handling, graceful error handling (no exception thrown on git failure).

## Commit

```
a2d1c37 feat: implement core initGit with .gitignore and first commit
```
