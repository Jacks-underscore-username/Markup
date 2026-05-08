import { asUniqueStr } from './baseTypes.d.js'
import * as Markup from './index.js'

const wrapper = /** @type {HTMLElement} */ (document.getElementById('app'))

const block = Markup.createBlock(wrapper, {
  value: asUniqueStr(
    `|[bold]Welcome to the Markup Editor|[bold]
|[break]
|[color #fff]White text|[color] back to default.
|[break]
|[italic]Italic.|[italic] |[bold italic]Bold italic.|[bold italic]
|[break]
|[align center]Centered|[align]
|[break]
|[fold open]
Inside a fold.
|[fold]`,
    'Markup'
  ),
  title: 'Demo markup editor',
  mode: 'edit',
  locked: true
})

block.on('change', value => console.log(`Block changed to value: ${value}`))
block.on('destroyed', value => console.log(`Block destroyed with value: ${value}`))
