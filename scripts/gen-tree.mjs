#!/usr/bin/env node
/**
 * gen-tree.mjs — 扫描 docs/ 目录结构，在根 README.md 的标记区间内
 * 自动生成最新的目录树，push 后由 GitHub Actions 调用。
 *
 * 用法：
 *   node scripts/gen-tree.mjs          # 写入 README.md
 *   node scripts/gen-tree.mjs --check  # 只校验是否最新（CI 用，不写入）
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const README = join(ROOT, 'README.md')

const START = '<!-- TREE:START -->'
const END = '<!-- TREE:END -->'

/** 不参与展示的目录 */
const IGNORE = new Set(['.vitepress', 'public', 'node_modules', '.git'])

async function listDirs(p) {
  const entries = await readdir(p, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && !IGNORE.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

async function walk(dir, prefix = '', depth = 0) {
  if (depth > 3) return []
  const dirs = await listDirs(dir)
  const lines = []

  for (let i = 0; i < dirs.length; i++) {
    const name = dirs[i]
    const last = i === dirs.length - 1
    const branch = last ? '└── ' : '├── '
    const childPrefix = prefix + (last ? '    ' : '│   ')
    lines.push(`${prefix}${branch}${name}/`)
    lines.push(...(await walk(join(dir, name), childPrefix, depth + 1)))
  }
  return lines
}

async function buildTree() {
  const top = await walk(DOCS)
  return ['docs/', ...top].join('\n')
}

function replaceBlock(readme, tree) {
  const block = `${START}\n\`\`\`text\n${tree}\n\`\`\`\n${END}`
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
  console.log('✅ 已更新 README.md 中的目录树。')
}

main().catch((err) => {
  console.error('❌ gen-tree 失败：', err.message)
  process.exit(1)
})
