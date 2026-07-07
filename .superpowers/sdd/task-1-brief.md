# Task 1: 项目脚手架和 package.json

## 文件
- Create: `C:\Users\admin\config-mgr\package.json`
- Create: `C:\Users\admin\config-mgr\bin\config-mgr.js`
- Create: `C:\Users\admin\config-mgr\src\core\.gitkeep`
- Create: `C:\Users\admin\config-mgr\src\hooks\.gitkeep`
- Create: `C:\Users\admin\config-mgr\templates\.gitkeep`
- Create: `C:\Users\admin\config-mgr\scripts\.gitkeep`
- Create: `C:\Users\admin\config-mgr\.gitignore`（项目自身 gitignore）

## 约束
- Node.js >= 18，type: module
- 零外部 npm 依赖
- package.json 的 files 字段只包含发布需要的目录

## 步骤
1. 创建 package.json（内容见下方）
2. 创建 bin/config-mgr.js（CLI 入口，内容见下方）
3. 创建 .gitkeep 文件（空文件）
4. 创建项目 .gitignore（node_modules/ 和 *.log）
5. 验证: `node bin/config-mgr.js` 显示帮助信息
6. 验证: `node bin/config-mgr.js unknown` 显示帮助信息
7. 提交

## package.json
```json
{
  "name": "@config-mgr/cli",
  "version": "0.1.0",
  "description": "基于 Git 的 AI 工具配置文件版本控制系统",
  "type": "module",
  "bin": {
    "config-mgr": "./bin/config-mgr.js"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT",
  "files": [
    "bin/",
    "src/",
    "templates/",
    "scripts/",
    "SKILL.md",
    "README.md",
    "UNINSTALL.md"
  ]
}
```

## bin/config-mgr.js
```javascript
#!/usr/bin/env node

const [,, command, ...args] = process.argv;

const commands = {
  init: async () => {
    const { default: install } = await import('../src/install.js');
    await install();
  },
  uninstall: async () => {
    const { default: uninstall } = await import('../src/uninstall.js');
    await uninstall();
  },
  recover: async () => {
    const { default: recover } = await import('../src/recover.js');
    await recover(args[0]);
  },
};

if (commands[command]) {
  commands[command]().catch(err => {
    console.error('config-mgr 错误:', err.message);
    process.exit(1);
  });
} else {
  console.log('用法: config-mgr <init|uninstall|recover>');
  console.log('  init       安装 config-mgr 到当前 AI 工具环境');
  console.log('  uninstall  卸载 config-mgr');
  console.log('  recover    查看历史或恢复配置（对话式引导）');
}
```

## .gitignore（项目自身）
```
node_modules/
*.log
```

## 报告文件
完成后写入 C:\Users\admin\config-mgr\.superpowers\sdd\task-1-report.md
包含：完成的文件列表、验证结果、commit hash
