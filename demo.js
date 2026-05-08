import { createEditor } from './index.js'

const editor = createEditor(document.getElementById('app'), {
  value: `|[bold]Welcome to the Markup Editor|[bold]
|[break]
|[color #0f0]Green text|[color] back to default.
|[break]
|[italic]Italic.|[italic] |[bold italic]Bold italic.|[bold italic]
|[break]
|[align center]Centered|[align]
|[break]
|[fold open]
Inside a fold.
|[fold]`,
  onChange: src => {
    console.log('changed', src)
  }
})
