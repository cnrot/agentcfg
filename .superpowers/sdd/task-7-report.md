# Task 7: Core squash.js —— 90 天历史压缩

**Status**: DONE

## Files Created
- `C:\Users\admin\config-mgr\src\core\squash.js` — 90-day history squash implementation
- `C:\Users\admin\config-mgr\src\core\squash.test.js` — Test suite

## Implementation
`squashOldHistory({ cwd, daysThreshold })` returns `{ squashed: boolean, message: string }`.

Logic:
1. Check if `.git` exists → skip if not
2. Find all commits before cutoff date → skip if none
3. Check if oldest old commit has a tag → skip if tagged (exemption)
4. `git reset --soft <oldestHash>^` + `git commit` to squash old history into one archive commit

## Test Results
All 15 tests pass across 4 scenarios:
- Non-git directory skip
- No old commits skip
- Tag exemption skip
- Successful squash (verifies commit count, archive message, file content integrity)

## Commit
`e89a69f` — `feat: implement 90-day history squash`
