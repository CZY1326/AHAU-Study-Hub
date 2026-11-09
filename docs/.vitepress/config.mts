import { defineConfig } from 'vitepress'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS = dirname(fileURLToPath(import.meta.url))

/**
 * 侧边栏自动生成：扫描 docs/ 下的一级模块目录，
 * 每个模块若含 index.md 则作为分组入口，其子目录（课程）各自成为条目。
 * 这样新增课程后不需要手动改配置。
 */
function buildSidebar() {
  const modules = readdirSync(DOCS)
    .filter((name) => /^\d{2}-/.test(name))
    .filter((name) => statSync(join(DOCS, name)).isDirectory())
    .sort()

  return modules.map((mod) => {
    const modDir = join(DOCS, mod)
    const children = readdirSync(modDir)
      .filter((name) => statSync(join(modDir, name)).isDirectory())
      .filter((name) => existsSync(join(modDir, name, 'index.md')))
      .sort()

    const items = [{ text: '本模块总览', link: `/${mod}/` }]

    if (children.length) {
      // 04~12 是课程模块（含选修通识），00~03 是文章主题模块
      const groupLabel = /^0[4-9]-|^1[0-2]-/.test(mod) ? '课程' : '主题'
      items.push({
        text: groupLabel,
        collapsed: false,
        items: children.map((c) => ({ text: c, link: `/${mod}/${c}/` })),
      })
    }

    return { text: mod, collapsed: false, items }
  })
}

export default defineConfig({
  lang: 'zh-CN',
  title: '安农学习时光',
  description: '安徽农业大学 (AHAU) 课程攻略共享计划 —— 以园艺学院培养方案为蓝本，整合本科四年的课程资料、期末真题、复习攻略与生活指南。',

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
          { text: '🚀 前言与基础概要', link: '/00-前言与基础概要/' },
          { text: '🏫 新生入学专栏', link: '/01-新生入学专栏/' },
          { text: '🎒 大学生活专栏', link: '/02-大学生活专栏/' },
          { text: '🧠 学业相关问题', link: '/03-学业相关问题/' },
        ],
      },
      {
        text: '课程资料',
        items: [
          { text: '① 大一第一学期', link: '/04-大一第一学期/' },
          { text: '② 大一第二学期', link: '/05-大一第二学期/' },
          { text: '③ 大二第一学期', link: '/06-大二第一学期/' },
          { text: '④ 大二第二学期', link: '/07-大二第二学期/' },
          { text: '⑤ 大三第一学期', link: '/08-大三第一学期/' },
          { text: '⑥ 大三第二学期', link: '/09-大三第二学期/' },
          { text: '⑦ 大四第一学期', link: '/10-大四第一学期/' },
          { text: '⑧ 大四第二学期', link: '/11-大四第二学期/' },
        ],
      },
      { text: '选修通识', link: '/12-选修和通识课/' },
      { text: '链接库', link: '/13-资料链接库/' },
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
      copyright: 'Copyright © 2026 AHAU Study Hub Contributors · MIT Licensed',
    },
  },
})
