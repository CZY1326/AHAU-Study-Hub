#!/usr/bin/env node
/**
 * check-links.mjs — 扫描 docs/ 下所有 Markdown 里的外部链接，
 * 用 HEAD 请求探测可用性，输出失效清单。
 *
 * 设计取舍：
 *   - 网盘链接（百度/夸克/阿里）经常对 HEAD 返回 403/405，这类「不可判定」
 *     单独归类为 UNKNOWN，不算失败，避免每天误报。
 *   - 并发受限（默认 6），并带超时，防止把 CI 跑挂。
 *
 * 用法：
 *   node scripts/check-links.mjs              # 只报告
 *   node scripts/check-links.mjs --fail       # 有 DEAD 链接时 exit 1（CI 用）
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')

const TIMEOUT_MS = 12000
const CONCURRENCY = 6
/** 这些平台的链接无法用机器可靠判定，单独放行 */
const UNVERIFIABLE = /(pan\.baidu\.com|aliyundrive\.com|alipan\.com|quark\.cn|115\.com|weiyun\.com|lanzou[a-z]*\.com|123pan\.com)/i

async function* walkMd(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '.vitepress' || e.name === 'public' || e.name === 'node_modules') continue
      yield* walkMd(full)
    } else if (e.name.endsWith('.md')) {
      yield full
    }
  }
}

/** 收集 markdown 里的 http(s) 链接，附带来源文件与行号 */
async function collectLinks() {
  const found = new Map() // url -> [{file, line}]
  const linkRe = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g

  for await (const file of walkMd(DOCS)) {
    const text = await readFile(file, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, idx) => {
      let m
      linkRe.lastIndex = 0
      while ((m = linkRe.exec(line)) !== null) {
        const url = m[1].replace(/[.,;)]+$/, '')
        if (!found.has(url)) found.set(url, [])
        found.get(url).push({ file: file.slice(ROOT.length + 1), line: idx + 1 })
      }
    })
  }
  return found
}

async function probe(url) {
  if (UNVERIFIABLE.test(url)) return 'UNKNOWN'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AHAU-Study-Hub link checker)' },
    })
    // 有些站点不支持 HEAD，退回 GET
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctl.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; AHAU-Study-Hub link checker)' },
      })
    }
    if (res.status >= 200 && res.status < 400) return 'OK'
    if ([401, 403, 429].includes(res.status)) return 'UNKNOWN'
    return 'DEAD'
  } catch {
    return 'DEAD'
  } finally {
    clearTimeout(timer)
  }
}

async function runPool(items, worker, concurrency) {
  const results = []
  let i = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  const failOnDead = process.argv.includes('--fail')
  const links = await collectLinks()
  const urls = [...links.keys()]

  console.log(`🔍 共发现 ${urls.length} 个外部链接（来自 ${new Set([...links.values()].flat().map((s) => s.file)).size} 个文件）`)

  const results = await runPool(
    urls,
    async (url) => ({ url, status: await probe(url) }),
    CONCURRENCY,
  )

  const dead = results.filter((r) => r.status === 'DEAD')
  const unknown = results.filter((r) => r.status === 'UNKNOWN')

  if (unknown.length) {
    console.log(`\n⚠️  无法自动判定 ${unknown.length} 个（网盘/需登录，视为通过）：`)
    unknown.forEach((r) => console.log(`   - ${r.url}`))
  }

  if (!dead.length) {
    console.log('\n✅ 未发现失效链接。')
    return
  }

  console.log(`\n❌ 发现 ${dead.length} 个失效链接：`)
  dead.forEach((r) => {
    console.log(`   - ${r.url}`)
    links.get(r.url).forEach((s) => console.log(`       ${s.file}:${s.line}`))
  })

  if (failOnDead) process.exit(1)
}

main().catch((err) => {
  console.error('❌ check-links 失败：', err)
  process.exit(1)
})
