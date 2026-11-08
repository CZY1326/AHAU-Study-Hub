#!/usr/bin/env node
/**
 * scaffold.mjs — 生成 AHAU-Study-Hub 的 docs/ 目录骨架与索引页。
 *
 * 设计原则（对应方案第一阶段 + 第二阶段）：
 *   1. 全部目录使用纯数字前缀，保证跨平台排序稳定（告别罗马数字 I/II/III 乱序）。
 *   2. 每个学期 / 每门课都产出一个 index.md，作为 VitePress 侧边栏落地页。
 *   3. 课程页内置「资料清单 + 避坑指南 + 复习攻略」三件套模板，供后续填内容。
 *
 * 幂等：已存在的文件不会被覆盖（用 --force 强制重写模板）。
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const FORCE = process.argv.includes('--force')

/* ------------------------------------------------------------------ *
 * 数据源：13 个一级模块 + 每学期课程清单
 * ------------------------------------------------------------------ */

const MODULES = [
  { dir: '00-前言与基础概要', title: '前言与基础概要', icon: '🚀', blurb: '项目缘起、使用说明、资料总览与更新日志。' },
  { dir: '01-新生入学专栏', title: '新生入学专栏', icon: '🏫', blurb: '报到流程、宿舍与军训、必备清单、校园地图。' },
  { dir: '02-大学生活专栏', title: '大学生活专栏', icon: '🎒', blurb: '食堂、社团、奖助学金、转专业与辅修。' },
  { dir: '03-学业相关问题', title: '学业相关问题', icon: '🧠', blurb: '选课、绩点、考试纪律、保研与考研答疑。' },
  { dir: '04-大一第一学期', title: '大一第一学期', icon: '①', blurb: '高数、英语、农概等公共基础课起步学期。' },
  { dir: '05-大一第二学期', title: '大一第二学期', icon: '②', blurb: 'C 语言、大学物理、思政课集中学期。' },
  { dir: '06-大二第一学期', title: '大二第一学期', icon: '③', blurb: '线性代数、概率论、专业导论。' },
  { dir: '07-大二第二学期', title: '大二第二学期', icon: '④', blurb: '专业基础课分流，实验课比重上升。' },
  { dir: '08-大三第一学期', title: '大三第一学期', icon: '⑤', blurb: '专业核心课 + 课程设计。' },
  { dir: '09-大三第二学期', title: '大三第二学期', icon: '⑥', blurb: '专业选修、实习实践、保研冲刺。' },
  { dir: '10-大四第一学期', title: '大四第一学期', icon: '⑦', blurb: '考研冲刺、秋招、毕业设计开题。' },
  { dir: '11-大四第二学期', title: '大四第二学期', icon: '⑧', blurb: '毕业设计、答辩、就业与升学收尾。' },
  { dir: '12-选修和通识课', title: '选修和通识课', icon: '🌱', blurb: '校公选、通识课避坑与给分口碑。' },
  { dir: '13-资料链接库', title: '资料链接库', icon: '🔗', blurb: '体积超过 50MB 的大文件网盘链接集中存放。' },
]

/** 每学期课程：[中文名, 英文/简称 slug] */
const SEMESTER_COURSES = {
  '04-大一第一学期': [
    ['高等数学A1', '高等数学A1'],
    ['大学英语1', '大学英语1'],
    ['农业概论', '农业概论'],
    ['思想道德与法治', '思想道德与法治'],
    ['计算机基础', '计算机基础'],
    ['体育1', '体育1'],
  ],
  '05-大一第二学期': [
    ['高等数学A2', '高等数学A2'],
    ['大学英语2', '大学英语2'],
    ['C语言程序设计', 'C语言程序设计'],
    ['大学物理', '大学物理'],
    ['中国近现代史纲要', '中国近现代史纲要'],
    ['体育2', '体育2'],
  ],
  '06-大二第一学期': [
    ['线性代数', '线性代数'],
    ['概率论与数理统计', '概率论与数理统计'],
    ['马克思主义基本原理', '马克思主义基本原理'],
    ['数据结构', '数据结构'],
    ['大学英语3', '大学英语3'],
  ],
  '07-大二第二学期': [
    ['大学英语4', '大学英语4'],
    ['离散数学', '离散数学'],
    ['面向对象程序设计', '面向对象程序设计'],
    ['毛泽东思想和中国特色社会主义理论体系概论', '毛泽东思想和中国特色社会主义理论体系概论'],
    ['专业导论', '专业导论'],
  ],
  '08-大三第一学期': [
    ['数据库原理', '数据库原理'],
    ['计算机网络', '计算机网络'],
    ['操作系统', '操作系统'],
    ['专业核心课（按学院自选）', '专业核心课'],
    ['习近平新时代中国特色社会主义思想概论', '习近平新时代中国特色社会主义思想概论'],
  ],
  '09-大三第二学期': [
    ['软件工程', '软件工程'],
    ['编译原理', '编译原理'],
    ['专业选修课', '专业选修课'],
    ['课程设计', '课程设计'],
    ['生产实习', '生产实习'],
  ],
  '10-大四第一学期': [
    ['毕业设计（开题）', '毕业设计-开题'],
    ['专业前沿讲座', '专业前沿讲座'],
    ['考研专业课冲刺', '考研专业课冲刺'],
  ],
  '11-大四第二学期': [
    ['毕业设计（论文与答辩）', '毕业设计-论文与答辩'],
    ['毕业实习', '毕业实习'],
  ],
}

/** 课程资料子目录（方案第二阶段目录树） */
const COURSE_SUBDIRS = ['课件', '试卷与答案', '复习资料']

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true })
}

async function emit(file, content) {
  if (!FORCE && await exists(file)) return false
  await ensureDir(dirname(file))
  await writeFile(file, content, 'utf8')
  return true
}

const written = []

/* ------------------------------------------------------------------ *
 * 模板
 * ------------------------------------------------------------------ */

function moduleIndex(mod) {
  return `# ${mod.icon} ${mod.title}

> ${mod.blurb}

::: tip 这里放什么
把该模块下的资料按「课程 / 主题」拆成子目录，每个子目录配一个 \`index.md\`。
VitePress 侧边栏会自动从目录结构生成，无需手动维护导航。
:::

## 📂 本模块内容

- 📄 见左侧侧边栏。
`
}

function semesterIndex(mod, courses) {
  const rows = courses
    .map(([cn]) => `| ${cn} | [进入](./${cn}/) | ⬜ 待补充 | ⬜ 待补充 |`)
    .join('\n')

  const anchors = courses
    .map(([cn]) => `- [${cn}](./${cn}/)`)
    .join('\n')

  return `# ${mod.icon} ${mod.title}

> ${mod.blurb}

## 📚 课程一览

| 课程 | 资料入口 | 真题 | 复习提纲 |
| :--- | :--- | :---: | :---: |
${rows}

## 🔗 快速跳转

${anchors}

## 💡 学期总攻略

::: warning 待补充
把这一学期的共性经验写在这里（选课顺序、考试周安排、哪些课是「纸老虎」、哪些课必须提前预习）。
:::
`
}

function courseIndex(courseName, semesterTitle) {
  return `# ${courseName}

> **开课学期**：${semesterTitle} ｜ **授课教师**：待补充 ｜ **学分**：待补充 ｜ **考核方式**：待补充

## 📚 资料清单

> 本节由 \`pnpm files\` 自动生成 —— 把文件放进 \`课件/\`、\`试卷与答案/\`、\`复习资料/\` 三个目录，清单会自动更新。
> 请勿手动编辑标记区间内的内容。

<!-- FILES:START -->
::: info 资料还在路上
这门课的课件 / 试卷与答案 / 复习资料暂未上传。
:::
<!-- FILES:END -->

## 💡 避坑指南与复习攻略

::: tip 待补充
1. **平时分**：占比多少？作业/考勤/课堂表现如何计分。
2. **期末**：难度如何？题型结构、重点章节、是否考原题。
3. **冲刺**：考前怎么突击最有效，推荐刷哪些题。
:::

## ⚠️ 免责声明

本目录资料仅用于学习交流，请勿用于任何商业用途；版权归原作者及安徽农业大学所有。
`
}

/* ------------------------------------------------------------------ *
 * 执行
 * ------------------------------------------------------------------ */

async function main() {
  await ensureDir(DOCS)

  // 根首页另由 docs/index.md 提供，这里只建模块骨架
  for (const mod of MODULES) {
    const modDir = join(DOCS, mod.dir)
    await ensureDir(modDir)

    const courses = SEMESTER_COURSES[mod.dir]
    const content = courses ? semesterIndex(mod, courses) : moduleIndex(mod)

    if (await emit(join(modDir, 'index.md'), content)) written.push(`${mod.dir}/index.md`)

    // 学期模块：为每门课建目录 + 三个资料子目录 + 课程 index.md
    if (courses) {
      for (const [cn] of courses) {
        const courseDir = join(modDir, cn)
        await ensureDir(courseDir)
        for (const sub of COURSE_SUBDIRS) {
          await ensureDir(join(courseDir, sub))
          const keep = join(courseDir, sub, '.gitkeep')
          if (!(await exists(keep))) {
            await writeFile(keep, '', 'utf8')
            written.push(`${mod.dir}/${cn}/${sub}/.gitkeep`)
          }
        }
        if (await emit(join(courseDir, 'index.md'), courseIndex(cn, mod.title))) {
          written.push(`${mod.dir}/${cn}/index.md`)
        }
      }
    }
  }

  console.log(`✅ 骨架生成完毕，共写入 ${written.length} 个文件。`)
  if (FORCE) console.log('   （--force 模式：已覆盖既有模板）')
}

main().catch((err) => {
  console.error('❌ scaffold 失败：', err)
  process.exit(1)
})
