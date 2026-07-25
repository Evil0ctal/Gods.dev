import { describe, it, expect } from 'vitest'
import { escapeHtml, cmdLink, aLink, line, htmlLine } from '../../src/components/terminal/core/utils'

describe('escapeHtml', () => {
  it('escapes angle brackets, quotes and ampersands', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')" & more>`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot; &amp; more&gt;',
    )
  })
  it('passes plain text through', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('link builders', () => {
  it('cmdLink renders a clickable command button', () => {
    expect(cmdLink('help')).toBe(
      '<button type="button" class="cmd-link" data-cmd="help">help</button>',
    )
  })
  it('cmdLink supports a custom label', () => {
    expect(cmdLink('blog read hello', 'hello')).toBe(
      '<button type="button" class="cmd-link" data-cmd="blog read hello">hello</button>',
    )
  })
  it('aLink renders an anchor', () => {
    expect(aLink('/blog/', 'blog')).toBe('<a class="term-link" href="/blog/">blog</a>')
  })
})

describe('line helpers', () => {
  it('line builds a plain OutputLine', () => {
    expect(line('hi', 'error')).toEqual({ text: 'hi', kind: 'error' })
  })
  it('htmlLine sets the html flag', () => {
    expect(htmlLine('<b>x</b>')).toEqual({ text: '<b>x</b>', html: true, kind: undefined })
  })
})
