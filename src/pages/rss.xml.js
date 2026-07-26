import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { SITE } from '../config/site'

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).map((p) => ({
    title: p.data.title,
    description: p.data.description,
    pubDate: p.data.pubDate,
    link: `/blog/${p.id}/`,
  }))
  const studies = (await getCollection('study', ({ data }) => !data.draft)).map((s) => ({
    title: s.data.title,
    description: s.data.description,
    pubDate: s.data.pubDate,
    link: `/study/${s.id}/`,
  }))
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items: [...posts, ...studies].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()),
  })
}
