#!/usr/bin/env node
/**
 * gen-tree.mjs — 扫描 docs/ 目录结构，在根 README.md 的标记区间内
 * 自动生成最新的目录树，push 后由 GitHub Actions 调用。
 *
 * 结构：顶层模块一览保持可见，每个模块用 <details> 折叠，
 * 02-课程资料 / 05-公选课外 内部再按学期 / 分组套一层折叠，
 * 避免 900+ 行的目录树把 README 撑得划不到底。
 *
 * 用法：
 *   node scripts/gen-tree.mjs          # 写入 README.md
 *   node scripts/gen-tree.mjs --check  # 只校验是否最新（CI 用，不写入）
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const README = join(ROOT, 'README.md')

const START = '<!-- TREE:START -->'
const END = '<!-- TREE:END -->'

/** 不参与展示的目录 */
const IGNORE = new Set(['.vitepress', 'public', 'node_modules', '.git'])

/** 需要按子分组二次折叠的模块：模块目录名 → 分组说明 */
const NESTED = {
  '02-课程资料': '学期',
  '05-公选课外': '分组',
}

async function listDirs(p) {
  const entries = await readdir(p, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && !IGNORE.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

/** depth 从 0 计，maxDepth 是允许展示的最深层级 */
async function walk(dir, prefix = '', depth = 0, maxDepth = Infinity) {
  if (depth > maxDepth) return []
  const dirs = await listDirs(dir)
  const lines = []

  for (let i = 0; i < dirs.length; i++) {
    const name = dirs[i]
    const last = i === dirs.length - 1
    const branch = last ? '└── ' : '├── '
    const childPrefix = prefix + (last ? '    ' : '│   ')
    lines.push(`${prefix}${branch}${name}/`)
    lines.push(...(await walk(join(dir, name), childPrefix, depth + 1, maxDepth)))
  }
  return lines
}

/** 递归统计子目录总数（不含自身） */
async function countDirs(dir) {
  const dirs = await listDirs(dir)
  let n = dirs.length
  for (const d of dirs) n += await countDirs(join(dir, d))
  return n
}

function fence(lines) {
  if (!lines.length) return '```text\n（空）\n```'
  return '```text\n' + lines.join('\n') + '\n```'
}

/** 单个可折叠块：<details> + 摘要 + 模块子树 */
async function detailsBlock(dir, name, maxDepth = Infinity, hint = '') {
  const lines = [`${name}/`, ...(await walk(dir, '', 0, maxDepth))]
  const count = await countDirs(dir)
  const summary = hint ? `${name}（${hint}）` : `${name}（${count} 个子目录）`
  return [
    '<details>',
    `<summary><strong>${summary}</strong> —— 点开展开</summary>`,
    '',
    fence(lines),
    '',
    '</details>',
  ].join('\n')
}

/** 带二层折叠的模块块（课程资料 / 公选课外） */
async function nestedBlock(dir, name, kind) {
  const groups = await listDirs(dir)
  const parts = [
    '<details>',
    `<summary><strong>${name}</strong>（${groups.length} 个${kind}，点开展开）</summary>`,
    '',
  ]
  for (const g of groups) {
    const courses = await listDirs(join(dir, g))
    parts.push(
      await detailsBlock(join(dir, g), g, 2, `${courses.length} 门课`),
      '',
    )
  }
  parts.push('</details>')
  return parts.join('\n')
}

async function buildTree() {
  const top = await listDirs(DOCS)

  // 顶层一览始终可见
  const overview = [
    'docs/',
    ...top.map((n, i) => `${i === top.length - 1 ? '└── ' : '├── '}${n}/`),
  ]

  const blocks = [fence(overview), '']
  for (const name of top) {
    const dir = join(DOCS, name)
    if (NESTED[name]) {
      blocks.push(await nestedBlock(dir, name, NESTED[name]), '')
    } else {
      blocks.push(await detailsBlock(dir, name), '')
    }
  }
  return blocks.join('\n')
}

function replaceBlock(readme, tree) {
  const block = `${START}\n${tree}\n${END}`
  const re = new RegExp(`${START}[\\s\\S]*?${END}`)
  if (!re.test(readme)) {
    throw new Error(`README.md 缺少目录树标记区间：${START} ... ${END}`)
  }
  return readme.replace(re, block)
}

async function main() {
  const check = process.argv.includes('--check')
  const tree = await buildTree()
  const readme = await readFile(README, 'utf8')
  const updated = replaceBlock(readme, tree)

  if (check) {
    if (updated !== readme) {
      console.error('❌ README.md 的目录树已过期，请运行 `npm run tree` 后提交。')
      process.exit(1)
    }
    console.log('✅ 目录树是最新的。')
    return
  }

  if (updated === readme) {
    console.log('ℹ️  目录树无变化，未写入。')
    return
  }

  await writeFile(README, updated, 'utf8')
  console.log('✅ 已更新 README.md 中的目录树（模块折叠版）。')
}

main().catch((err) => {
  console.error('❌ gen-tree 失败：', err.message)
  process.exit(1)
})
