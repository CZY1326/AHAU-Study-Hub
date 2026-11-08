# AHAU-Study-Hub 项目长期笔记

## 项目定位

安徽农业大学（AHAU）本科四年课程资料知识库。
站点：https://czy1326.github.io/AHAU-Study-Hub/
仓库：https://github.com/CZY1326/AHAU-Study-Hub （public，main 为 default branch）

## 技术栈（重要：已从 pnpm 迁移到 npm）

**VitePress 1.6.4 + GitHub Actions + GitHub Pages**

- 包管理器：**npm**（曾用 pnpm，因 CI 上 corepack 冲突严重，2026-11-08 迁移）
- 锁文件：`package-lock.json`
- **不要重新引入 pnpm**，也不要往 package.json 加 `packageManager` 字段
  （那是 corepack 的触发源，会与 CI 冲突导致部署失败）
- 站点 base：`/AHAU-Study-Hub/`

## 目录结构约定

```
docs/
├── 00-前言与基础概要/       # 非课程模块
├── 01-新生入学专栏/
├── 02-大学生活专栏/
├── 03-学业相关问题/
├── 04-大一第一学期/         # 学期模块
│   └── 高等数学A1/          # 课程
│       ├── index.md
│       ├── 课件/            # 资料：课件
│       ├── 试卷与答案/      # 资料：真题
│       └── 复习资料/        # 资料：复习提纲
├── 05-...  到  11-大四第二学期/
├── 12-选修和通识课/
└── 13-资料链接库/           # >50MB 大文件的外链登记
```

- 一级模块统一 `NN-` 数字前缀，保证排序稳定（不用罗马数字）
- 每门课固定三个资料子目录，顺序为 课件 → 试卷与答案 → 复习资料

## 构建脚本

| 脚本 | 文件 | 作用 |
| :--- | :--- | :--- |
| `npm run files` | `scripts/gen-courses.mjs` | 扫描课程目录，生成资料清单到课程页标记区间 |
| `npm run files:copy` | 同上 `--copy` | 构建后把资料文件复制进 dist（CI 用） |
| `npm run tree` | `scripts/gen-tree.mjs` | 刷新 README 目录树（TREE:START 区间） |
| `npm run checklinks` | `scripts/check-links.mjs` | 外链巡检，网盘链接自动放行 |
| `npm run scaffold` | `scripts/scaffold.mjs` | 补齐缺失目录与 index.md |

`gen-courses.mjs` 还有 `--check` 模式供 CI 幂等校验。

## 关键技术约束（踩过的坑）

### 1. 资料下载链接必须用原生 `<a>` 标签

**不能用 Markdown 链接语法。** VitePress 会把 Markdown 链接当站内路由解析并做死链检查，
`.md` 类型的资料（如复习笔记）会被误判为死链，**导致整个站点构建失败**。

脚本里生成的是：`<a href="..." target="_blank">在线查看</a>` 或 `<a href="..." download>下载</a>`

### 2. 原生 `<a href>` 不会自动拼 base

所以要显式加上 `/AHAU-Study-Hub/`，并用 `encodeURI` 处理中文路径。
`gen-courses.mjs` 里有 `BASE` 常量。

**仓库改名时必须同步改两处 base**：
- `docs/.vitepress/config.mts` 的 `base`
- `scripts/gen-courses.mjs` 的 `BASE`

### 3. VitePress 只发布 `docs/public/` 下的静态资源

课程目录里的 PDF/PPT 默认不进站点，必须靠 `files:copy` 显式复制到 `dist/资料/`。

### 4. `ignoreDeadLinks: false` 是正确的

VitePress 的死链检查**只检查站内链接**，外链不受影响。
不要改成 `'localhostLinks'`（那个只忽略 localhost，非所需）。

### 5. 课程页的标记区间

资料清单由脚本维护在 `<!-- FILES:START -->` / `<!-- FILES:END -->` 之间，
对应段落标题是 `## 📚 资料清单`。**不要手改这段内容。**

正确顺序：`课件 → 试卷与答案 → 复习资料`（脚本里 SECTIONS 数组的顺序）

## CI/CD

`.github/workflows/deploy.yml` —— 推送 main 触发
流程：Setup Node → Diagnose → `npm ci` → Setup Pages → `npm run files`
→ `npm run docs:build` → `npm run files:copy` → Upload artifact → Deploy

`.github/workflows/maintenance.yml` —— 每日 UTC 02:00
死链巡检（失效则自动开 `dead-link` issue）+ 刷新 README 目录树并自动提交

**Pages 配置**：用官方 action 部署时不需要手动选 Source，
`configure-pages` + `deploy-pages` 首次成功运行会自动创建站点，
`build_type` 直接设为 `workflow`。

## 资料摆放约定

| 体积 | 放哪里 |
| :--- | :--- |
| < 50 MB | 直接提交进仓库对应课程目录 |
| > 50 MB | 写进 `13-资料链接库/` 登记外链 |

GitHub 单文件硬上限 100 MB。

## git 身份

仓库级配置（非全局）：
`CZY1326 <CZY1326@users.noreply.github.com>`
远端用 SSH：`git@github.com-ahau:CZY1326/AHAU-Study-Hub.git`

## 环境注意事项

- 该环境 `pnpm`、`gh`、`npm` 都不在 PATH，需用绝对路径或 python
- `curl` 直连 `api.github.com` 返回 HTTP 000（不通）；
  但 `python urllib` 带 Authorization header 可正常访问
- 查 CI 状态/日志建议写 python 脚本
