import { copyTheme1PromptToClipboard } from '../lib/ai-client'
import type { ImageElementInfo } from '../lib/types'

const highlightBtn = document.getElementById('highlight-btn') as HTMLButtonElement
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement
const status = document.getElementById('status') as HTMLElement
const elementList = document.getElementById('element-list') as HTMLOListElement

let lastElements: ImageElementInfo[] = []

async function activeTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')
  return tab.id
}

function renderElementList(elements: ImageElementInfo[]): void {
  elementList.innerHTML = ''
  for (const el of elements) {
    const li = document.createElement('li')
    li.textContent = `#${el.id} — alt: ${el.alt === null ? '(missing)' : JSON.stringify(el.alt)}`
    elementList.appendChild(li)
  }
}

highlightBtn.addEventListener('click', async () => {
  status.textContent = 'Numbering images…'
  try {
    const tabId = await activeTabId()
    const response = await chrome.tabs.sendMessage(tabId, { type: 'RGAA_HIGHLIGHT_IMAGES' })
    lastElements = response?.elements ?? []
    renderElementList(lastElements)
    copyBtn.disabled = lastElements.length === 0
    clearBtn.disabled = false
    status.textContent = `Found ${lastElements.length} image(s). Take a screenshot now, then copy the prompt.`
  } catch (err) {
    status.textContent = 'Could not reach the page. Reload the tab and try again.'
    console.error(err)
  }
})

copyBtn.addEventListener('click', async () => {
  try {
    await copyTheme1PromptToClipboard(lastElements)
    status.textContent = 'Prompt copied — paste your screenshot, then this, into your chat UI.'
  } catch (err) {
    status.textContent = 'Could not copy to clipboard.'
    console.error(err)
  }
})

clearBtn.addEventListener('click', async () => {
  try {
    const tabId = await activeTabId()
    await chrome.tabs.sendMessage(tabId, { type: 'RGAA_CLEAR_HIGHLIGHTS' })
    elementList.innerHTML = ''
    lastElements = []
    copyBtn.disabled = true
    clearBtn.disabled = true
    status.textContent = 'Highlights cleared.'
  } catch (err) {
    status.textContent = 'Could not reach the page.'
    console.error(err)
  }
})
