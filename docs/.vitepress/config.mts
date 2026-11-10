import { defineConfig } from 'vitepress'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS = dirname(fileURLToPath(import.meta.url))

/**
 * 侧边栏自动生成：扫描 docs/ 下的 NN- 一级模块目录，递归处理子目录。
 * 规则：
 *   - 子目录有 index.md 且其下没有「子目录/index.md」结构 → 叶子条目（课程/主题页）；
 *   - 子目录下还有课程页 → 分组（可折叠），带 index.md 时组内首条挂「分组总览」；
 * 支持任意层级嵌套（如 02-课程资料/01-大一第一学期/高等数学Ⅲ），
 * 新增课程后不需要手动改配置。
 */
function buildSidebar() {
  const modules = readdirSync(DOCS)
    .filter((name) => /^\d{2}-/.test(name))
    .filter((name) => statSync(join(DOCS, name)).isDirectory())
    .sort()

  /** 目录下是否存在「子目录/子目录/index.md」结构（即是否为分组目录） */
  const hasCourseChildren = (dir) =>
    readdirSync(dir).some((name) => {
      const p = join(dir, name)
      return statSync(p).isDirectory() && existsSync(join(p, 'index.md'))
    })

  const buildItems = (dir, prefix) => {
    const items = []
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name)
      if (!statSync(p).isDirectory()) continue
      const child = prefix ? `${prefix}/${name}` : name
      if (hasCourseChildren(p)) {
        const group = { text: name, collapsed: false, items: buildItems(p, child) }
        if (existsSync(join(p, 'index.md'))) {
          group.items.unshift({ text: '分组总览', link: `/${child}/` })
        }
        items.push(group)
      } else if (existsSync(join(p, 'index.md'))) {
        items.push({ text: name, link: `/${child}/` })
      }
    }
    return items
  }

  return modules.map((mod) => ({
    text: mod,
    collapsed: false,
    items: [{ text: '本模块总览', link: `/${mod}/` }, ...buildItems(join(DOCS, mod), mod)],
  }))
}

export default defineConfig({
  lang: 'zh-CN',
  title: '安农学习时光',
  description: '安徽农业大学 (AHAU) 本科四年课程资料、真题与避坑指南 —— 因为淋过雨，所以想为学弟学妹撑把伞。',

  // GitHub Pages 项目站点需设置 base 为 /<repo>/
  base: '/AHAU-Study-Hub/',

  cleanUrls: true,
  lastUpdated: true,
  // 站内链接必须有效（拼错直接构建失败，保证导航质量）。
  // 注意：VitePress 本身只检查站内链接，外部链接不受此选项影响，
  // 外链失效由 .github/workflows/maintenance.yml 的每日巡检单独负责。
  // 另：课程页里的资料下载链接使用原生 <a> 标签而非 Markdown 链接，
  // 否则 VitePress 会把 PDF / 笔记当成站内路由去解析并报死链。
  ignoreDeadLinks: false,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/AHAU-Study-Hub/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#2f7d4f' }],
    ['meta', { name: 'author', content: 'AHAU Study Hub Contributors' }],
  ],

  markdown: {
    lineNumbers: true,
    image: { lazyLoading: true },
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      {
        text: '快速开始',
        items: [
          { text: '前言概要', link: '/00-前言概要/' },
          { text: '仓库指南', link: '/00-前言概要/00-仓库指南/' },
          { text: '新生专栏', link: '/01-新生专栏/' },
          { text: '生活专栏', link: '/04-生活专栏/' },
          { text: '学业专栏', link: '/03-学业专栏/' },
        ],
      },
      {
        text: '课程资料',
        items: [
          { text: '① 大一第一学期', link: '/02-课程资料/01-大一第一学期/' },
          { text: '② 大一第二学期', link: '/02-课程资料/02-大一第二学期/' },
          { text: '③ 大二第一学期', link: '/02-课程资料/03-大二第一学期/' },
          { text: '④ 大二第二学期', link: '/02-课程资料/04-大二第二学期/' },
          { text: '⑤ 大三第一学期', link: '/02-课程资料/05-大三第一学期/' },
          { text: '⑥ 大三第二学期', link: '/02-课程资料/06-大三第二学期/' },
          { text: '⑦ 大四第一学期', link: '/02-课程资料/07-大四第一学期/' },
          { text: '⑧ 大四第二学期', link: '/02-课程资料/08-大四第二学期/' },
        ],
      },
      { text: '公选课外', link: '/05-公选课外/' },
    ],

    sidebar: buildSidebar(),

    outline: { level: [2, 3], label: '本页目录' },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索资料', buttonAriaLabel: '搜索资料' },
          modal: {
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/CZY1326/AHAU-Study-Hub' }],

    editLink: {
      pattern: 'https://github.com/CZY1326/AHAU-Study-Hub/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    lastUpdatedText: '最后更新',

    footer: {
      message: '资料仅供学习交流 · 版权归原作者及安徽农业大学所有',
      copyright: 'Copyright © 2026 AHAU Study Hub Contributors · CC BY-NC-SA 4.0',
    },
  },
})
