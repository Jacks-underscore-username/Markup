import { asUniqueStr } from './baseTypes.d.js'
import markup from './markup.js'

const MONACO_BASE = './monaco-editor/vs'

/**
 * @param {import('./types.d.js').MarkupStr} rawMarkup
 * @param {number} [scale]
 * @param {string[]} [classes]
 * @returns {{ html: import('./types.d.js').HtmlStr, highlights: import('./types.d.js').MonacoHighlight[] }}
 */
export const render = (rawMarkup, scale = 1, classes = []) => markup.translate(rawMarkup, scale, classes)

/** @type {Promise<typeof monaco> | null} */
let monacoReady = null

const loadMonaco = () => {
  if (monacoReady !== null) return monacoReady
  monacoReady = new Promise((resolve, reject) => {
    if (typeof monaco !== 'undefined') {
      resolve(monaco)
      return
    }
    const script = document.createElement('script')
    script.src = `${MONACO_BASE}/loader.js`
    script.onerror = reject
    script.onload = () => {
      // @ts-expect-error
      require.config({ paths: { vs: MONACO_BASE } })
      // @ts-expect-error
      require(['vs/editor/editor.main'], () => {
        registerLanguage()
        resolve(monaco)
      })
    }
    document.head.appendChild(script)
  })
  return monacoReady
}

const registerLanguage = () => {
  if (monaco.languages.getLanguages().some(/** @param {{ id: string }} l */ l => l.id === 'markup-lang')) return
  monaco.languages.register({ id: 'markup-lang' })
  monaco.languages.setMonarchTokensProvider('markup-lang', {
    tokenizer: {
      root: [[/\|\[/, 'markup.bracket', '@tag']],
      tag: [
        [/\]/, 'markup.bracket', '@pop'],
        [
          /\b(bold|italic|color|break|align|size|code|fold|reset|default|space|tab|image|video|strike|underline|link|script|showMarkup|COMMENT)\b/,
          'markup.keyword'
        ],
        [/#[0-9a-fA-F]+/, 'markup.color'],
        [/[0-9]+(\.[0-9]+)?/, 'markup.number'],
        [/[^\]\s]+/, 'markup.value']
      ]
    }
  })
  monaco.editor.defineTheme('markup-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'markup.bracket', foreground: '666666' },
      { token: 'markup.keyword', foreground: '569cd6', fontStyle: 'bold' },
      { token: 'markup.color', foreground: 'ce9178' },
      { token: 'markup.number', foreground: 'b5cea8' },
      { token: 'markup.value', foreground: '9cdcfe' }
    ],
    colors: {}
  })
}

/**
 * @param {HTMLElement} container
 */
const execScripts = container => {
  for (const old of Array.from(/** @type {NodeListOf<HTMLScriptElement>} */ (container.querySelectorAll('script')))) {
    if (old.textContent?.includes('document.currentScript')) continue
    const s = document.createElement('script')
    if (old.src) s.src = old.src
    else s.textContent = old.textContent
    old.replaceWith(s)
  }
}

/**
 * @param {HTMLElement} container
 */
const setupFolders = container => {
  // @ts-expect-error
  if (!window.markup) window.markup = {}
  // @ts-expect-error
  window.markup.folder = event => {
    event.stopPropagation()
    const folder = /** @type {HTMLElement} */ (event.target.closest('.folder'))
    const header = /** @type {HTMLElement} */ (folder.children[0])
    const content = /** @type {HTMLElement} */ (folder.children[1])
    const open = content.style.display === 'none'
    header.innerHTML = header.innerHTML.replace(open ? 'open' : 'close', open ? 'close' : 'open')
    content.style.display = open ? '' : 'none'
    const saved = JSON.parse(sessionStorage.getItem('markup') ?? '{}')
    saved[`id_${folder.dataset['id']}`] = open
    sessionStorage.setItem('markup', JSON.stringify(saved))
  }
  const saved = JSON.parse(sessionStorage.getItem('markup') ?? '{}')
  for (const folder of Array.from(/** @type {NodeListOf<HTMLElement>} */ (container.querySelectorAll('.folder')))) {
    const open = saved[`id_${folder.dataset['id']}`]
    if (open === undefined) continue
    const header = /** @type {HTMLElement} */ (folder.children[0])
    const content = /** @type {HTMLElement} */ (folder.children[1])
    header.innerHTML = header.innerHTML.replace(open ? 'open' : 'close', open ? 'close' : 'open')
    content.style.display = open ? '' : 'none'
  }
}

/**
 * @param {string} tag
 * @param {Partial<CSSStyleDeclaration>} [styles]
 * @param {Record<string, string>} [attrs]
 * @returns {HTMLElement}
 */
const el = (tag, styles = {}, attrs = {}) => {
  const e = document.createElement(tag)
  Object.assign(e.style, styles)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

/**
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
const mkBtn = label => {
  const b = /** @type {HTMLButtonElement} */ (
    el('button', {
      background: '#151515',
      border: '1px solid #555',
      borderRadius: '4px',
      color: '#888',
      fontFamily: 'monospace',
      fontSize: '13px',
      fontWeight: 'bold',
      padding: '3px 10px',
      cursor: 'pointer'
    })
  )
  b.textContent = label
  b.addEventListener('mouseenter', () => {
    if (!b.dataset['active']) b.style.color = '#0f0'
  })
  b.addEventListener('mouseleave', () => {
    if (!b.dataset['active']) b.style.color = '#888'
  })
  return b
}

export class MarkupEditor {
  /** @type {import('./types.d.js').MarkupStr} */
  _value

  /** @type {monaco.editor.IStandaloneCodeEditor} */
  // @ts-expect-error
  _monaco = null

  /** @type {boolean} */
  _scrollLock = false

  /** @type {((src: import('./types.d.js').MarkupStr) => void)[]} */
  _onChange = []

  /** @type {{ editor: HTMLButtonElement, split: HTMLButtonElement, preview: HTMLButtonElement }} */
  // @ts-expect-error
  _btns = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _editorPane = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _divider = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _preview = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _panes = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _statusErr = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _statusInfo = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  _root = null

  /**
   * @param {HTMLElement} container
   * @param {{ value?: import('./types.d.js').MarkupStr, onChange?: (src: import('./types.d.js').MarkupStr) => void }} [opts]
   */
  constructor(container, opts = {}) {
    this._value = asUniqueStr(opts.value ?? '', 'Markup')
    if (opts.onChange) this._onChange.push(opts.onChange)
    this._build(container)
    loadMonaco().then(m => this._mount(m))
  }

  /** @param {HTMLElement} container */
  _build = container => {
    this._root = el('div', {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#151515',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '14px'
    })

    const toolbar = el('div', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      height: '36px',
      background: '#2a2a2a',
      borderBottom: '1px solid #555',
      flexShrink: '0'
    })
    const title = el('span', { fontWeight: 'bold', fontStyle: 'italic', color: '#0f0' })
    title.textContent = 'Markup Editor'
    const btnRow = el('div', { display: 'flex', gap: '6px' })
    this._btns = { editor: mkBtn('Editor'), split: mkBtn('Split'), preview: mkBtn('Preview') }
    btnRow.append(this._btns.editor, this._btns.split, this._btns.preview)
    toolbar.append(title, btnRow)

    this._panes = el('div', { display: 'flex', flex: '1', minHeight: '0' })
    this._editorPane = el('div', { flexBasis: '100%', flexShrink: '0', minWidth: '0', height: '100%' })
    this._divider = el('div', {
      width: '4px',
      background: '#555',
      cursor: 'col-resize',
      flexShrink: '0',
      display: 'none'
    })
    this._preview = el('div', {
      flexBasis: '50%',
      flexShrink: '0',
      minWidth: '0',
      height: '100%',
      borderLeft: '1px solid #555',
      background: '#1e1e1e',
      color: '#0f0',
      fontFamily: 'monospace',
      padding: '8px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      display: 'none'
    })
    this._divider.addEventListener('mouseenter', () => {
      this._divider.style.background = '#0f0'
    })
    this._divider.addEventListener('mouseleave', () => {
      this._divider.style.background = '#555'
    })
    this._preview.addEventListener('scroll', () => {
      if (this._scrollLock || !this._monaco) return
      const total = this._preview.scrollHeight - this._preview.clientHeight
      if (total <= 0) return
      this._scrollLock = true
      this._monaco.setScrollTop((this._preview.scrollTop / total) * this._monaco.getScrollHeight())
      requestAnimationFrame(() => {
        this._scrollLock = false
      })
    })
    this._panes.append(this._editorPane, this._divider, this._preview)

    const statusbar = el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '2px 12px',
      height: '22px',
      fontSize: '12px',
      background: '#2a2a2a',
      borderTop: '1px solid #555',
      flexShrink: '0'
    })
    this._statusErr = el('span', { color: 'hsl(0,100%,50%)' })
    this._statusInfo = el('span', { color: '#888' })
    statusbar.append(this._statusErr, this._statusInfo)

    this._root.append(toolbar, this._panes, statusbar)
    container.appendChild(this._root)

    this._btns.editor.addEventListener('click', () => this.setMode('editor'))
    this._btns.split.addEventListener('click', () => this.setMode('split'))
    this._btns.preview.addEventListener('click', () => this.setMode('preview'))
    this._setupDrag()
  }

  /** @param {typeof monaco} m */
  _mount = m => {
    this._monaco = m.editor.create(this._editorPane, {
      value: this._value,
      language: 'markup-lang',
      theme: 'markup-dark',
      fontSize: 14,
      fontFamily: 'monospace',
      minimap: { enabled: false },
      wordWrap: 'on',
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      automaticLayout: false
    })
    this._monaco.addCommand(monaco.KeyCode.Tab, () => this._monaco.trigger('keyboard', 'type', { text: '   ' }))
    this._monaco.onDidChangeModelContent(() => {
      this._render()
      for (const fn of this._onChange) fn(asUniqueStr(this.getValue(), 'Markup'))
    })
    this._monaco.onDidScrollChange(() => {
      if (this._scrollLock) return
      const total = this._monaco.getScrollHeight() - this._monaco.getLayoutInfo().height
      if (total <= 0) return
      this._scrollLock = true
      const ratio = this._monaco.getScrollTop() / total
      this._preview.scrollTop = ratio * (this._preview.scrollHeight - this._preview.clientHeight)
      requestAnimationFrame(() => {
        this._scrollLock = false
      })
    })
    this.setMode('editor')
    this._render()
  }

  _render = () => {
    this._statusErr.textContent = ''
    try {
      const src = asUniqueStr(this._monaco ? this._monaco.getValue() : this._value, 'Markup')
      this._preview.innerHTML = markup.translate(src, 1, []).html
      setupFolders(this._preview)
      execScripts(this._preview)
      const lines = src.split('\n').length
      this._statusInfo.textContent = `${lines} line${lines !== 1 ? 's' : ''}`
    } catch (e) {
      this._statusErr.textContent = e instanceof Error ? e.message : String(e)
      this._statusInfo.textContent = ''
    }
  }

  /** @param {'editor' | 'split' | 'preview'} mode */
  _setActiveBtn = mode => {
    for (const [k, b] of Object.entries(this._btns)) {
      const active = k === mode
      b.dataset['active'] = active ? 'true' : ''
      b.style.color = active ? '#0f0' : '#888'
      b.style.borderColor = active ? '#0f0' : '#555'
      b.style.background = active ? '#1a2e1a' : '#151515'
    }
  }

  _setupDrag = () => {
    let dragging = false
    this._divider.addEventListener('mousedown', e => {
      dragging = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })
    document.addEventListener('mousemove', e => {
      if (!dragging) return
      const rect = this._panes.getBoundingClientRect()
      const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100))
      this._editorPane.style.flexBasis = `${pct}%`
      this._preview.style.flexBasis = `${100 - pct - (4 / rect.width) * 100}%`
      if (this._monaco) this._monaco.layout()
    })
    document.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    })
  }

  /** @param {'editor' | 'split' | 'preview'} mode */
  setMode = mode => {
    this._setActiveBtn(mode)
    if (mode === 'editor') {
      this._editorPane.style.display = ''
      this._editorPane.style.flexBasis = '100%'
      this._divider.style.display = 'none'
      this._preview.style.display = 'none'
    } else if (mode === 'split') {
      this._editorPane.style.display = ''
      this._editorPane.style.flexBasis = '50%'
      this._divider.style.display = ''
      this._preview.style.display = ''
      this._preview.style.flexBasis = '50%'
    } else {
      this._editorPane.style.display = 'none'
      this._divider.style.display = 'none'
      this._preview.style.display = ''
      this._preview.style.flexBasis = '100%'
    }
    if (this._monaco) requestAnimationFrame(() => this._monaco.layout())
    this._render()
  }

  /** @returns {import('./types.d.js').MarkupStr} */
  getValue = () => asUniqueStr(this._monaco ? this._monaco.getValue() : this._value, 'Markup')

  /** @param {import('./types.d.js').MarkupStr} src */
  setValue = src => {
    this._value = src
    if (this._monaco) this._monaco.setValue(src)
  }

  /** @returns {{ value: import('./types.d.js').MarkupStr }} */
  export = () => ({ value: this.getValue() })

  /**
   * @param {'change'} event
   * @param {(src: import('./types.d.js').MarkupStr) => void} fn
   */
  on = (event, fn) => {
    if (event === 'change') this._onChange.push(fn)
  }

  destroy = () => {
    if (this._monaco) this._monaco.dispose()
    this._root.remove()
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ value?: import('./types.d.js').MarkupStr, onChange?: (src: import('./types.d.js').MarkupStr) => void }} [options]
 * @returns {MarkupEditor}
 */
export const createEditor = (container, options = {}) => new MarkupEditor(container, options)

/**
 * @param {HTMLElement} container
 * @param {{ value: import('./types.d.js').MarkupStr }} exportedData
 * @param {{ onChange?: (src: import('./types.d.js').MarkupStr) => void }} [options]
 * @returns {MarkupEditor}
 */
export const importEditor = (container, exportedData, options = {}) =>
  new MarkupEditor(container, { ...options, value: exportedData.value ?? '' })
