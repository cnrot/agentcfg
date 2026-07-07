# Task 5 Report: Core log.js

## Status: DONE

## Commit
- `99ab8cc` feat: implement git log formatter

## Files
- `src/core/log.js` — `getLog()` implementation
- `src/core/log.test.js` — 6 test cases, 20 assertions

## Test Results
- All 20/20 assertions passed
- Covered scenarios:
  1. **有历史时返回正确格式** — 6 assertions (hash 8-bit, date without timezone, full message)
  2. **空仓库返回空数组** — 2 assertions
  3. **count 限制** — 3 assertions (count=3 returns exactly 3)
  4. **filePath 过滤** — 5 assertions (correct filtered results for a.txt and b.txt)
  5. **目录不存在时返回空数组** — 2 assertions
  6. **非 git 目录返回空数组** — 2 assertions
