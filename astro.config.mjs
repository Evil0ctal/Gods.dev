import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://gods.dev',
  compressHTML: false, // 保留源码中的注释彩蛋与可读性（view-source 是产品的一部分）
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
})
