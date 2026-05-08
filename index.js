// @ts-expect-error
/** @type {import('./monaco-editor/monaco.js')} */

import { asUniqueStr } from './baseTypes.d.js'
import markup from './markup.js'

let MONACO_BASE = './monaco-editor/vs'

/**
 * @param {string} path
 */
export const setMonacoBase = path => (MONACO_BASE = path)

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
  monaco.languages.registerCompletionItemProvider('markup-lang', {
    triggerCharacters: ['[', ' '],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber)
      const col = position.column - 1

      const textBefore = line.slice(0, col)
      const tagStart = textBefore.lastIndexOf('|[')
      if (tagStart === -1) return { suggestions: [] }

      const afterTagStart = textBefore.slice(tagStart + 2)
      if (afterTagStart.includes(']')) return { suggestions: [] }

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column
      }

      const tokensBefore = afterTagStart.trim().split(/\s+/).filter(Boolean)
      const lastToken = tokensBefore[tokensBefore.length - 1] ?? ''
      const prevToken = tokensBefore[tokensBefore.length - 2]?.toLowerCase() ?? ''
      const currentToken = lastToken
      const atValue = afterTagStart.endsWith(' ') || afterTagStart.endsWith('\t')
      const keywordBeforeValue = atValue ? (tokensBefore[tokensBefore.length - 1] ?? '').toLowerCase() : prevToken

      /** @param {string[]} values @param {string} detail */
      const valueItems = (values, detail) =>
        values.map(v => ({
          label: v,
          kind: monaco.languages.CompletionItemKind.Value,
          insertText: v,
          detail,
          range
        }))

      const keywords = [
        'color',
        'italic',
        'bold',
        'space',
        'tab',
        'break',
        'size',
        'code',
        'align',
        'reset',
        'default',
        'fold',
        'image',
        'video',
        'strike',
        'underline',
        'link',
        'script',
        'showMarkup',
        'COMMENT'
      ]

      const keywordDescriptions = {
        color: 'Set text color',
        italic: 'Toggle/set italic',
        bold: 'Toggle/set bold',
        space: 'Insert non-breaking spaces',
        tab: 'Insert tab spaces',
        break: 'Insert line break',
        size: 'Set font size',
        code: 'Toggle/set code style',
        align: 'Set text alignment',
        reset: 'Reset style property',
        default: 'Set style as default',
        fold: 'Create foldable section',
        image: 'Embed an image',
        video: 'Embed a video',
        strike: 'Toggle/set strikethrough',
        underline: 'Toggle/set underline',
        link: 'Create a hyperlink',
        script: 'Embed a script',
        showMarkup: 'Show/hide markup tags',
        COMMENT: 'Comment out this line'
      }

      const onOffToggle = ['on', 'off', 'true', 'false']

      /** @type {Record<string, string[]>} */
      const valueMap = {
        italic: onOffToggle,
        bold: onOffToggle,
        code: onOffToggle,
        strike: onOffToggle,
        underline: onOffToggle,
        showmarkup: onOffToggle,
        align: ['left', 'center', 'right'],
        size: ['xx-small', 'x-small', 'smaller', 'small', 'medium', 'large', 'larger', 'x-large', 'xx-large'],
        fold: ['open', 'close'],
        reset: ['color', 'italic', 'bold', 'size', 'code', 'align', 'strike', 'underline', 'showMarkup'],
        default: ['global']
      }

      if (atValue && keywordBeforeValue && valueMap[keywordBeforeValue])
        return { suggestions: valueItems(valueMap[keywordBeforeValue], `${keywordBeforeValue} value`) }

      if (!atValue && tokensBefore.length >= 2) {
        const kw = prevToken.toLowerCase()
        if (valueMap[kw]) {
          const partial = currentToken.toLowerCase()
          const filtered = valueMap[kw].filter(v => v.toLowerCase().startsWith(partial))
          const wordStart = col - currentToken.length + 1
          return {
            suggestions: filtered.map(v => ({
              label: v,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: v,
              detail: `${kw} value`,
              range: { ...range, startColumn: wordStart }
            }))
          }
        }
      }

      const partial = (atValue ? '' : currentToken).toLowerCase()
      const wordStart = atValue ? col + 1 : col - currentToken.length + 1
      return {
        suggestions: keywords
          .filter(k => k.toLowerCase().startsWith(partial))
          .map(k => ({
            label: k,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: k,
            // @ts-expect-error
            detail: keywordDescriptions[k] ?? '',
            range: { ...range, startColumn: wordStart }
          }))
      }
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

export class MarkupWrapper {
  /** @type {import('./types.d.js').EditorOptions} */
  #options

  /** @type {import('./types.d.js').MarkupStr} */
  #value

  /** @type {monaco.editor.IStandaloneCodeEditor} */
  // @ts-expect-error
  #monaco = null

  /** @type {boolean} */
  #scrollLock = false

  /** @type {((src: import('./types.d.js').MarkupStr) => void)[]} */
  #onChange = []

  /** @type {((src: import('./types.d.js').MarkupStr) => void)[]} */
  #onDestroyed = []

  /** @type {{ exit: HTMLButtonElement, editor: HTMLButtonElement, split: HTMLButtonElement, preview: HTMLButtonElement }} */
  // @ts-expect-error
  #btns = {}

  /** @type {HTMLElement} */
  // @ts-expect-error
  #editorPane = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  #divider = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  #preview = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  #panes = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  #statusErr = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  #statusInfo = null

  /** @type {HTMLElement} */
  // @ts-expect-error
  #root = null

  /**
   * @param {HTMLElement} container
   * @param {import('./types.d.js').EditorOptions} options
   */
  constructor(container, options) {
    this.#options = options
    this.#value = asUniqueStr(options.value ?? '', 'Markup')
    this.#build(container)
    loadMonaco().then(m => this.#mount(m))
  }

  /**
   * @param {HTMLElement} container
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: It is
  #build = container => {
    this.#root = el('div', {
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

    const useToolbar = this.#options.title !== undefined || this.#options.mode === 'edit' || !this.#options.locked

    if (useToolbar) {
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
      title.textContent = this.#options.title ?? ''
      const btnRow = el('div', { display: 'flex', gap: '6px' })
      if (!this.#options.locked) {
        this.#btns.exit = mkBtn('Exit')
        btnRow.append(this.#btns.exit)
      }

      if (this.#options.mode === 'edit') {
        this.#btns.editor = mkBtn('Editor')
        this.#btns.split = mkBtn('Split')
        this.#btns.preview = mkBtn('Preview')
        btnRow.append(this.#btns.editor, this.#btns.split, this.#btns.preview)
      }
      toolbar.append(title, btnRow)

      this.#root.append(toolbar)
    }

    this.#panes = el('div', { display: 'flex', flex: '1', minHeight: '0' })
    if (this.#options.mode === 'edit')
      this.#editorPane = el('div', { flexBasis: '100%', flexShrink: '0', minWidth: '0', height: '100%' })
    if (this.#options.mode === 'edit')
      this.#divider = el('div', {
        width: '4px',
        background: '#555',
        cursor: 'col-resize',
        flexShrink: '0',
        display: 'none'
      })
    this.#preview = el('div', {
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
    if (this.#options.mode === 'edit') {
      this.#divider.addEventListener('mouseenter', () => {
        this.#divider.style.background = '#0f0'
      })
      this.#divider.addEventListener('mouseleave', () => {
        this.#divider.style.background = '#555'
      })
      this.#preview.addEventListener('scroll', () => {
        if (this.#scrollLock || !this.#monaco) return
        const total = this.#preview.scrollHeight - this.#preview.clientHeight
        if (total <= 0) return
        this.#scrollLock = true
        this.#monaco.setScrollTop((this.#preview.scrollTop / total) * this.#monaco.getScrollHeight())
        requestAnimationFrame(() => {
          this.#scrollLock = false
        })
      })
    }

    if (this.#options.mode === 'edit') this.#panes.append(this.#editorPane, this.#divider)
    this.#panes.append(this.#preview)

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
    this.#statusErr = el('span', { color: 'hsl(0,100%,50%)' })
    this.#statusInfo = el('span', { color: '#888' })
    statusbar.append(this.#statusErr, this.#statusInfo)

    this.#root.append(this.#panes, statusbar)
    container.appendChild(this.#root)

    if (!this.#options.locked) {
      this.#btns.exit.addEventListener('click', () => this.destroy())
      document.addEventListener('keydown', event => {
        if (event.code === 'Escape') this.destroy()
      })
    }

    if (this.#options.mode === 'edit') {
      this.#btns.editor.addEventListener('click', () => this.setMode('editor'))
      this.#btns.split.addEventListener('click', () => this.setMode('split'))
      this.#btns.preview.addEventListener('click', () => this.setMode('preview'))
      this.#setupDrag()
    }
  }

  /**
   * @param {typeof monaco} m
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: It is
  #mount = m => {
    if (this.#options.mode === 'edit') {
      this.#monaco = m.editor.create(this.#editorPane, {
        value: this.#value,
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
      this.#monaco.addCommand(monaco.KeyCode.Tab, () => {
        const suggest = this.#monaco.getContribution('editor.contrib.suggestController')
        // @ts-expect-error
        if (suggest?.model?.state !== 0) {
          this.#monaco.trigger('keyboard', 'acceptSelectedSuggestion', {})
        } else {
          this.#monaco.trigger('keyboard', 'type', { text: '   ' })
        }
      })
      this.#monaco.onDidChangeModelContent(() => {
        this.#render()
        for (const fn of this.#onChange) fn(asUniqueStr(this.getValue(), 'Markup'))
      })
      this.#monaco.onDidScrollChange(() => {
        if (this.#scrollLock) return
        const total = this.#monaco.getScrollHeight() - this.#monaco.getLayoutInfo().height
        if (total <= 0) return
        this.#scrollLock = true
        const ratio = this.#monaco.getScrollTop() / total
        this.#preview.scrollTop = ratio * (this.#preview.scrollHeight - this.#preview.clientHeight)
        requestAnimationFrame(() => {
          this.#scrollLock = false
        })
      })
    }
    this.setMode(this.#options.mode === 'edit' ? 'split' : 'preview')
    this.#render()
  }

  #render = () => {
    this.#statusErr.textContent = ''
    try {
      const src = asUniqueStr(this.#monaco ? this.#monaco.getValue() : this.#value, 'Markup')
      this.#preview.innerHTML = markup.translate(src, 1, []).html
      setupFolders(this.#preview)
      execScripts(this.#preview)
      const lines = src.split('\n').length
      this.#statusInfo.textContent = `${lines} line${lines !== 1 ? 's' : ''}`
    } catch (e) {
      this.#statusErr.textContent = e instanceof Error ? e.message : String(e)
      this.#statusInfo.textContent = ''
      console.error(e instanceof Error ? e.message : String(e))
    }
  }

  /** @param {'editor' | 'split' | 'preview'} mode */
  #setActiveBtn = mode => {
    if (!this.#btns) return
    for (const [k, b] of Object.entries(this.#btns)) {
      const active = k === mode
      b.dataset['active'] = active ? 'true' : ''
      b.style.color = active ? '#0f0' : '#888'
      b.style.borderColor = active ? '#0f0' : '#555'
      b.style.background = active ? '#1a2e1a' : '#151515'
    }
  }

  #setupDrag = () => {
    let dragging = false
    this.#divider.addEventListener('mousedown', e => {
      dragging = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })
    document.addEventListener('mousemove', e => {
      if (!dragging) return
      const rect = this.#panes.getBoundingClientRect()
      const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100))
      this.#editorPane.style.flexBasis = `${pct}%`
      this.#preview.style.flexBasis = `${100 - pct - (4 / rect.width) * 100}%`
      if (this.#monaco) this.#monaco.layout()
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
    if (this.#options.mode === 'view' && mode !== 'preview')
      throw new Error(`Cannot set the mode to ${mode} in a view only block`)
    this.#setActiveBtn(mode)
    if (mode === 'editor') {
      this.#editorPane.style.display = ''
      this.#editorPane.style.flexBasis = '100%'
      this.#divider.style.display = 'none'
      this.#preview.style.display = 'none'
    } else if (mode === 'split') {
      this.#editorPane.style.display = ''
      this.#editorPane.style.flexBasis = '50%'
      this.#divider.style.display = ''
      this.#preview.style.display = ''
      this.#preview.style.flexBasis = '50%'
    } else {
      if (this.#editorPane) {
        this.#editorPane.style.display = 'none'
        this.#divider.style.display = 'none'
      }
      this.#preview.style.display = ''
      this.#preview.style.flexBasis = '100%'
    }
    if (this.#monaco) requestAnimationFrame(() => this.#monaco.layout())
    this.#render()
  }

  /** @returns {import('./types.d.js').MarkupStr} */
  getValue = () => asUniqueStr(this.#monaco ? this.#monaco.getValue() : this.#value, 'Markup')

  /** @param {import('./types.d.js').MarkupStr} src */
  setValue = src => {
    this.#value = src
    if (this.#monaco) this.#monaco.setValue(src)
  }

  /**
   * @param {'change' | 'destroyed'} event
   * @param {(src: import('./types.d.js').MarkupStr) => void} fn
   */
  on = (event, fn) => {
    if (event === 'change') this.#onChange.push(fn)
    if (event === 'destroyed') this.#onDestroyed.push(fn)
  }

  destroy = () => {
    for (const fn of this.#onDestroyed) fn(asUniqueStr(this.getValue(), 'Markup'))
    if (this.#monaco) this.#monaco.dispose()
    this.#root.remove()
  }
}

/**
 * @param {HTMLElement} container
 * @param {import('./types.d.js').EditorOptions} options
 * @returns {MarkupWrapper}
 */
export const createBlock = (container, options) => new MarkupWrapper(container, options)

/**
 * @param {HTMLElement} container
 * @param {{ value: import('./types.d.js').MarkupStr }} exportedData
 * @param {import('./types.d.js').EditorOptions} options
 * @returns {MarkupWrapper}
 */
export const importBlock = (container, exportedData, options) =>
  new MarkupWrapper(container, { ...options, value: exportedData.value ?? '' })
