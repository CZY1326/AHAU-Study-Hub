#!/usr/bin/env node
/**
 * check-size.mjs — 强制 60 MB 单文件上限。
 *
 * 约定：docs/ 下单个文件 < 60 MB 直接提交进仓库；
 * >= 60 MB 的资料不进仓库，登记到 scripts/big-files.json（网盘链接合并进课程页资料清单）。
 *
 * 为什么存在：过去用 .gitignore 按扩展名（*.mp4/*.zip 等）一刀切忽略，
 * 导致文件本地存在但从未入库，本地构建正常、CI 构建失败且难以排查。
 * 现在改为「允许提交、CI 校验大小」，问题在推送前就能暴露。
 *
 * 用法：
 *   node scripts/check-size.mjs   # 超限列文件并退出码 1（CI 用）
 */
import { readdir, stat } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')

/** 60 MB 安全线（GitHub 单文件硬上限 100 MB，>60MB 推送时会有警告） */
const LIMIT = 60 * 1024 * 1024

/** 人类可读的文件大小 */
function humanSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const oversized = []

async function walk(current) {
  const entries = await readdir(current, { withFileTypes: true })
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = join(current, e.name)
    if (e.isDirectory()) {
      if (e.name === '.vitepress') continue
      await walk(full)
      continue
    }
    const info = await stat(full)
    if (info.size >= LIMIT) {
      oversized.push({ rel: relative(ROOT, full), size: info.size })
    }
  }
}

await walk(DOCS)

if (oversized.length) {
  console.error(`❌ 发现 ${oversized.length} 个超过 60 MB 的文件：\n`)
  for (const f of oversized) {
    console.error(`   ${humanSize(f.size).padStart(8)}  ${f.rel}`)
  }
  console.error('\n按约定，>= 60 MB 的资料应先压缩或按页段分割成多卷（每卷 < 60 MB）再入库；确无办法压缩的，登记到 scripts/big-files.json 后删除本地大文件。')
  process.exit(1)
}

console.log('✅ 所有文件均在 60 MB 以内。')
