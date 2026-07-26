/** 新约经典篇章精选：终端 `bible classics` 与 ~/bible/classics.txt 共用 */
export interface ClassicPassage {
  title: string
  /** 卷 slug，与 public/bible/<slug>.json 对应 */
  book: string
  /** 章:节[-节] 引用，如 '5:3-12' */
  ref: string
}

export const CLASSIC_PASSAGES: ClassicPassage[] = [
  { title: 'The Beatitudes', book: 'matthew', ref: '5:3-12' },
  { title: "The Lord's Prayer", book: 'matthew', ref: '6:9-13' },
  { title: 'Do Not Worry', book: 'matthew', ref: '6:25-34' },
  { title: 'The Golden Rule', book: 'matthew', ref: '7:12' },
  { title: 'The Greatest Commandment', book: 'matthew', ref: '22:36-40' },
  { title: 'The Great Commission', book: 'matthew', ref: '28:18-20' },
  { title: 'The Christmas Story', book: 'luke', ref: '2:1-20' },
  { title: 'The Good Samaritan', book: 'luke', ref: '10:25-37' },
  { title: 'The Prodigal Son', book: 'luke', ref: '15:11-32' },
  { title: 'The Resurrection', book: 'luke', ref: '24:1-12' },
  { title: 'In the Beginning Was the Word', book: 'john', ref: '1:1-14' },
  { title: 'For God So Loved the World', book: 'john', ref: '3:16-17' },
  { title: 'I Am the Way', book: 'john', ref: '14:1-7' },
  { title: 'Nothing Can Separate Us', book: 'romans', ref: '8:35-39' },
  { title: 'Love Is Patient', book: '1corinthians', ref: '13:1-13' },
  { title: 'The Fruit of the Spirit', book: 'galatians', ref: '5:22-23' },
  { title: 'The Armor of God', book: 'ephesians', ref: '6:10-18' },
  { title: 'Rejoice Always', book: 'philippians', ref: '4:4-9' },
  { title: 'Faith Is', book: 'hebrews', ref: '11:1-3' },
  { title: 'A New Heaven and a New Earth', book: 'revelation', ref: '21:1-7' },
]
