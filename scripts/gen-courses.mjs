#!/usr/bin/env node
/**
 * gen-courses.mjs — 扫描每门课下的「课件 / 试卷与答案 / 复习资料」三个子目录，
 * 把真实存在的资料汇总成表格，写回课程页 index.md 的标记区间内。
 *
 * 解决两个问题：
 *   1. 课程页不再是一句「见 xxx 文件夹」，访客能直接看到有什么、多大、点哪下。
 *   2. 新增资料只需要把文件丢进目录，页面清单自动长出来，不用手改 Markdown。
 *
 * 资料文件放置约定：
 *   直接放在 docs/<学期>/<课程>/课件/ 等目录下（保留现有目录结构）。
 *   构建后由本脚本的 --copy 模式把它们复制进 dist，保证下载链接可用。
 *
 * 用法：
 *   node scripts/gen-courses.mjs           # 扫描并写入课程页
 *   node scripts/gen-courses.mjs --check   # 只校验是否最新（CI 用，不写入）
 *   node scripts/gen-courses.mjs --copy    # 复制资料到 dist（构建后执行）
 */
import { readdir, readFile, writeFile, stat, mkdir, copyFile, access } from 'node:fs/promises'
import { join, dirname, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const DIST = join(DOCS, '.vitepress', 'dist')

const START = '<!-- FILES:START -->'
const END = '<!-- FILES:END -->'

/**
 * 站点 base 前缀，必须与 docs/.vitepress/config.mts 里的 base 保持一致。
 * 原生 <a href> 不会被 VitePress 自动拼接 base，所以这里要显式加上，
 * 否则部署到 GitHub Pages 子路径后下载链接会 404。
 */
const BASE = '/AHAU-Study-Hub/'
const ASSET_PREFIX = '资料'

/** 每门课固定三个资料子目录，顺序即展示顺序 */
const SECTIONS = [
  { dir: '课件', icon: '📊', label: '课件' },
  { dir: '试卷与答案', icon: '📝', label: '试卷与答案' },
  { dir: '复习资料', icon: '📖', label: '复习资料' },
]

/** 不参与展示的文件 */
const IGNORE_FILES = new Set(['.gitkeep', '.DS_Store', 'Thumbs.db'])

/**
 * 扩展名 → 展示类型
 * kind: 决定用什么图标与是否支持页内预览
 */
const FILE_TYPES = {
  '.pdf': { icon: '📕', label: 'PDF', kind: 'pdf' },
  '.ppt': { icon: '📊', label: 'PPT', kind: 'slide' },
  '.pptx': { icon: '📊', label: 'PPT', kind: 'slide' },
  '.doc': { icon: '📄', label: 'DOC', kind: 'doc' },
  '.docx': { icon: '📄', label: 'DOC', kind: 'doc' },
  '.xls': { icon: '📈', label: 'XLS', kind: 'sheet' },
  '.xlsx': { icon: '📈', label: 'XLS', kind: 'sheet' },
  '.zip': { icon: '🗜️', label: 'ZIP', kind: 'archive' },
  '.7z': { icon: '🗜️', label: '7Z', kind: 'archive' },
  '.rar': { icon: '🗜️', label: 'RAR', kind: 'archive' },
  '.md': { icon: '📝', label: '笔记', kind: 'text' },
  '.txt': { icon: '📝', label: '文本', kind: 'text' },
  '.png': { icon: '🖼️', label: '图片', kind: 'image' },
  '.jpg': { icon: '🖼️', label: '图片', kind: 'image' },
  '.jpeg': { icon: '🖼️', label: '图片', kind: 'image' },
  '.mp4': { icon: '🎬', label: '视频', kind: 'video' },
}

/** 支持页内预览的类型（点击即在浏览器打开） */
const PREVIEWABLE = new Set(['pdf', 'image', 'video', 'text'])

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function isDir(p) {
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

/** 人类可读的文件大小 */
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 数字前缀排序：让 10 排在 2 后面（而不是 ASCII 序的 10 < 2） */
function naturalCompare(a, b) {
  const na = a.match(/^(\d+)/)
  const nb = b.match(/^(\d+)/)
  if (na && nb) {
    const diff = Number(na[1]) - Number(nb[1])
    if (diff !== 0) return diff
  }
  return a.localeCompare(b, 'zh-CN')
}

/* ------------------------------------------------------------------ *
 * 扫描
 * ------------------------------------------------------------------ */

/**
 * 递归收集一个目录下的所有资料文件（含子层）。
 * 返回 [{ name, relPath, size, type }]，relPath 是相对 docs/ 的路径。
 */
async function collectFiles(dir, docsRelBase) {
  if (!(await isDir(dir))) return []
  const out = []

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const e of entries) {
      if (IGNORE_FILES.has(e.name)) continue
      if (e.name.startsWith('.')) continue
      const full = join(current, e.name)
      if (e.isDirectory()) {
        await walk(full)
        continue
      }
      const ext = extname(e.name).toLowerCase()
      const type = FILE_TYPES[ext]
      if (!type) continue // 未知类型不入表，避免把临时文件写进页面
      const info = await stat(full)
      out.push({
        name: e.name,
        relPath: relative(docsRelBase, full).split('\\').join('/'),
        size: info.size,
        type,
      })
    }
  }

  await walk(dir)
  return out.sort((a, b) => naturalCompare(a.name, b.name))
}

/**
 * 扫描一门课，返回三个 section 的资料清单。
 * courseDir 形如 docs/04-大一第一学期/高等数学A1
 */
async function scanCourse(courseDir) {
  const result = []
  for (const sec of SECTIONS) {
    const files = await collectFiles(join(courseDir, sec.dir), DOCS)
    if (files.length) result.push({ ...sec, files })
  }
  return result
}

/* ------------------------------------------------------------------ *
 * 渲染
 * ------------------------------------------------------------------ */

/**
 * 把一门课的资料清单渲染成 Markdown。
 *
 * 关键点：这里使用原生 <a> 标签而不是 Markdown 链接语法。
 * 原因：VitePress 会把 Markdown 链接当成站点内部路由去解析并做死链检查，
 * 而资料文件并不存在对应的页面，`.md` 类型的资料会被误判为死链导致构建失败。
 * 原生 <a href> 不走路由解析，且能配合 download 属性触发浏览器下载。
 */
function renderSections(courseRelPath, sections) {
  if (!sections.length) {
    return [
      '::: info 资料还在路上',
      '这门课的课件 / 试卷与答案 / 复习资料暂未上传。',
      '如果你手上有**历年真题**或**老师的复习提纲**，欢迎提 PR 补进来 —— 那是价值最高的东西。',
      ':::',
    ].join('\n')
  }

  const blocks = []

  for (const sec of sections) {
    const rows = sec.files
      .map((f) => {
        // 文件在仓库中的位置：docs/<课程路径>/<子目录>/<文件名>
        // 站点中映射到：<base>/资料/<课程路径>/<子目录>/<文件名>
        // 用 <a href> 而非 Markdown 链接，绕开 VitePress 的内部路由死链检查。
        const sitePath = encodeURI(`${BASE}${ASSET_PREFIX}/${courseRelPath}/${sec.dir}/${f.name}`)
        const previewable = PREVIEWABLE.has(f.type.kind)
        // 可预览类型：新窗口直接打开（PDF/图片/视频浏览器原生支持）
        // 其他类型：触发下载
        const attrs = previewable
          ? 'target="_blank" rel="noopener"'
          : 'download'
        const action = previewable ? '在线查看' : '下载'
        return `| ${f.type.icon} ${f.name} | ${f.type.label} | ${humanSize(f.size)} | <a href="${sitePath}" ${attrs}>${action}</a> |`
      })
      .join('\n')

    blocks.push(
      `### ${sec.icon} ${sec.label}（${sec.files.length}）\n\n` +
        `| 文件 | 类型 | 大小 | 操作 |\n` +
        `| :--- | :---: | ---: | :--- |\n` +
        rows,
    )
  }

  blocks.push(
    '::: tip 关于下载\n' +
      'PDF 与图片可直接在浏览器里**在线查看**；PPT / Word / Excel / 压缩包点「下载」后用本地软件打开。\n' +
      '单文件超过 50 MB 的资料不进仓库，请到 [13-资料链接库](/13-资料链接库/) 找外链。\n' +
      ':::',
  )

  return blocks.join('\n\n')
}

/** 替换课程页里的 FILES 标记区间 */
function replaceBlock(md, content) {
  const block = `${START}\n${content}\n${END}`
  const re = new RegExp(`${START}[\\s\\S]*?${END}`)
  if (!re.test(md)) return null // 没有标记区间，跳过（不是所有 md 都是课程页）
  return md.replace(re, block)
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

/** 找出所有课程页：深度为 2 的 index.md（docs/<学期>/<课程>/index.md） */
async function findCoursePages() {
  const pages = []
  const semesters = await readdir(DOCS, { withFileTypes: true })

  for (const sem of semesters) {
    if (!sem.isDirectory()) continue
    if (!/^\d{2}-/.test(sem.name)) continue
    const semDir = join(DOCS, sem.name)
    const courses = await readdir(semDir, { withFileTypes: true })

    for (const c of courses) {
      if (!c.isDirectory()) continue
      const idx = join(semDir, c.name, 'index.md')
      if (await exists(idx)) {
        pages.push({
          file: idx,
          courseRel: `${sem.name}/${c.name}`,
          courseDir: join(semDir, c.name),
        })
      }
    }
  }
  return pages
}

async function runGenerate(checkOnly) {
  const pages = await findCoursePages()
  let changed = 0
  let skipped = 0
  let totalFiles = 0

  for (const page of pages) {
    const md = await readFile(page.file, 'utf8')
    const sections = await scanCourse(page.courseDir)
    totalFiles += sections.reduce((n, s) => n + s.files.length, 0)

    const content = renderSections(page.courseRel, sections)
    const updated = replaceBlock(md, content)

    if (updated === null) {
      skipped++
      continue
    }
    if (updated === md) continue

    changed++
    if (!checkOnly) {
      await writeFile(page.file, updated, 'utf8')
      console.log(`  ✏️  ${page.courseRel}`)
    } else {
      console.log(`  ⚠️  ${page.courseRel} 的资料清单已过期`)
    }
  }

  const stats = `${pages.length} 门课，索引 ${totalFiles} 个资料文件`
  if (checkOnly) {
    if (changed) {
      console.error(`\n❌ 课程资料清单已过期（${stats}），请运行 \`npm run files\` 后提交。`)
      process.exit(1)
    }
    console.log(`✅ 所有课程资料清单均为最新（${stats}）。`)
    return
  }
  console.log(`\n✅ 完成：${stats}，更新 ${changed} 页${skipped ? `，跳过 ${skipped} 页（无标记区间）` : ''}。`)
}

/**
 * 把 docs 下的资料文件复制到 dist/资料/，使下载链接可用。
 * VitePress 只发布 public/ 里的静态资源，课程目录里的 PDF 默认不会进站点。
 */
async function runCopy() {
  if (!(await exists(DIST))) {
    console.error('❌ 未找到 dist 目录，请先运行 `npm run docs:build`。')
    process.exit(1)
  }

  const pages = await findCoursePages()
  let copied = 0
  let bytes = 0

  for (const page of pages) {
    for (const sec of SECTIONS) {
      const secDir = join(page.courseDir, sec.dir)
      if (!(await isDir(secDir))) continue

      const files = await collectFiles(secDir, DOCS)
      for (const f of files) {
        const src = join(DOCS, f.relPath)
        const dst = join(DIST, '资料', page.courseRel, sec.dir, f.name)
        await mkdir(dirname(dst), { recursive: true })
        await copyFile(src, dst)
        copied++
        bytes += f.size
      }
    }
  }

  console.log(`✅ 已复制 ${copied} 个资料文件到 dist/资料/（共 ${humanSize(bytes)}）。`)
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const copyOnly = process.argv.includes('--copy')

  if (copyOnly) {
    await runCopy()
    return
  }
  await runGenerate(checkOnly)
}

main().catch((err) => {
  console.error('❌ gen-courses 失败：', err.message)
  process.exit(1)
})
