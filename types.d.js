/** @typedef {import("./baseTypes.d").UniqueString<string, 'Markup'>} MarkupStr */
/** @typedef {import("./baseTypes.d").UniqueString<string, 'Html'>} HtmlStr */

/** @typedef {{ Markup: MarkupStr, Html: HtmlStr }} KnownUniqueStringTypes */

/**
 * For markup element styling
 * @typedef {Object} CssStyleObj
 * @prop {boolean} [code]
 * @prop {string} [color]
 * @prop {boolean} [italic]
 * @prop {string} [align]
 * @prop {boolean} [bold]
 * @prop {string} [size]
 * @prop {boolean} [showMarkup]
 * @prop {boolean} [strike]
 * @prop {boolean} [underline]
 */

/**
 * For dynamic highlighting in the monaco editor
 * @typedef {Object} MonacoHighlight
 * @prop {number} start
 * @prop {number} length
 * @prop {number} line
 * @prop {MonacoHighlightType} type
 */

/**
 * For dynamic highlighting in the monaco editor
 * @typedef {Object} MonacoHighlightType
 * @prop {boolean} italic
 * @prop {boolean} bold
 * @prop {boolean} underline
 * @prop {string} color
 */

/**
 * @typedef {Object} BaseEditorOptions
 * @prop {string} [title]
 * @prop {boolean} locked
 */

/**
 * @typedef {Object} EditModeOptions
 * @prop {'edit'} mode
 * @prop {MarkupStr} [value]
 *  */

/**
 * @typedef {Object} ViewModeOptions
 * @prop {'view'} mode
 * @prop {MarkupStr} value
 */

/**
 * @typedef {BaseEditorOptions & (EditModeOptions | ViewModeOptions)} EditorOptions
 */
