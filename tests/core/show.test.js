/**
 * src/core/show.js — parseShow / splitByFile 单元测试
 */
import assert from 'node:assert/strict';
import { splitByFile } from '../../src/core/show.js';

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function bad(label, err) { failed++; console.log(`  ❌ ${label}: ${err}`); }

function run(name, fn) {
  console.log(`\n测试: ${name}`);
  try {
    fn();
    ok(name);
  }
  catch (e) { bad(name, e.message); }
}

// ─── 1. 空输入 → 空数组 ───
run('splitByFile: 空字符串 → []', () => {
  assert.deepEqual(splitByFile(''), []);
  assert.deepEqual(splitByFile('   \n   \n'), []);
});

// ─── 2. 单文件 modified ───
run('splitByFile: 单 M 文件 3 行', () => {
  const raw = `diff --git a/foo.js b/foo.js
index 1234567..89abcde 100644
--- a/foo.js
+++ b/foo.js
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3`;
  const files = splitByFile(raw);
  assert.equal(files.length, 1, '1 个文件');
  assert.equal(files[0].name, 'foo.js');
  assert.equal(files[0].status, 'M');
  assert.equal(files[0].startLine, 1);
  assert.equal(files[0].lines.length, 4, '4 lines: n + d + a + n');
  assert.equal(files[0].lines[0].type, 'n');
  assert.equal(files[0].lines[1].type, 'd');
  assert.equal(files[0].lines[2].type, 'a');
  assert.equal(files[0].lines[1].line, 'old');
  assert.equal(files[0].lines[2].line, 'new');
});

// ─── 3. 新增文件 → status A ───
run('splitByFile: 新文件 status=A', () => {
  const raw = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..ce01362
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+hello
+world`;
  const files = splitByFile(raw);
  assert.equal(files.length, 1);
  assert.equal(files[0].status, 'A');
  assert.equal(files[0].lines.length, 2);
  assert.equal(files[0].lines.every(l => l.type === 'a'), true, '全是 added');
});

// ─── 4. 删除文件 → status D ───
run('splitByFile: 删除文件 status=D', () => {
  const raw = `diff --git a/old.txt b/old.txt
deleted file mode 100644
index ce01362..0000000
--- a/old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-bye
-cruel`;
  const files = splitByFile(raw);
  assert.equal(files.length, 1);
  assert.equal(files[0].status, 'D');
  assert.equal(files[0].lines.every(l => l.type === 'd'), true, '全是 deleted');
});

// ─── 5. 多文件 ───
run('splitByFile: 2 个文件块', () => {
  const raw = `diff --git a/a.js b/a.js
index abc..def 100644
--- a/a.js
+++ b/a.js
@@ -1,1 +1,1 @@
-old
+new
diff --git a/b.json b/b.json
new file mode 100644
index 000..111
--- /dev/null
+++ b/b.json
@@ -0,0 +1,1 @@
+{}`;
  const files = splitByFile(raw);
  assert.equal(files.length, 2);
  assert.equal(files[0].name, 'a.js');
  assert.equal(files[0].status, 'M');
  assert.equal(files[1].name, 'b.json');
  assert.equal(files[1].status, 'A');
});

// ─── 6. startLine 跟随 hunk ───
run('splitByFile: startLine 来自 @@ hunk', () => {
  const raw = `diff --git a/x.py b/x.py
index 1..2
--- a/x.py
+++ b/x.py
@@ -10,2 +12,3 @@
 a
+b
 c`;
  const files = splitByFile(raw);
  assert.equal(files[0].startLine, 12, 'startLine 取 hunk 中 + 行号');
});

// ─── 7. 二进制文件 → 跳过(不报 parse error)───
run('splitByFile: 二进制文件不抛错', () => {
  const raw = `diff --git a/img.png b/img.png
index 1..2
Binary files a/img.png and b/img.png differ`;
  const files = splitByFile(raw);
  assert.equal(files.length, 1);
  assert.equal(files[0].lines.length, 0, '二进制文件无 lines');
});

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
