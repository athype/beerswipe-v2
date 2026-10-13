import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Drink } from '@beerswipe/types'
import ShoppingListModal from '../ShoppingListModal.vue'
import { useNotifications } from '@/composables/useNotifications'
import { buildShoppingListText } from '@/utils/shoppingList'

const drink = (id: number, name: string, stock: number): Drink => ({
  id,
  name,
  stock,
  description: null,
  price: 1,
  isActive: true,
  isAlcohol: false,
  category: 'beverage',
})

const out = [drink(1, 'Cola', 0), drink(2, 'Spa Blauw', 0)]
const low = [drink(3, 'Heineken 0.0', 2)]

const { notifications, clearAllNotifications } = useNotifications()

const mountModal = (props: { out?: Drink[]; low?: Drink[] } = {}) =>
  mount(ShoppingListModal, {
    props: { show: true, out, low, ...props },
    attachTo: document.body,
  })

const buttonByText = (label: string): HTMLButtonElement | undefined =>
  Array.from(document.body.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label
  )

const mockShare = (implementation: () => Promise<void>) => {
  const share = vi.fn(implementation)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  return share
}

beforeEach(() => {
  clearAllNotifications()
})

afterEach(() => {
  document.body.innerHTML = ''
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('ShoppingListModal', () => {
  it('previews the exact list text with a summary', () => {
    mountModal()

    const preview = document.body.querySelector('.shopping-list-preview')
    const summary = document.body.querySelector('.shopping-list-summary')

    expect(preview?.textContent).toBe(buildShoppingListText(out, low))
    expect(summary?.textContent).toBe('2 out of stock, 1 low')
  })

  it('hides Share when the browser has no share sheet', () => {
    mountModal()

    expect(buttonByText('Share')).toBeUndefined()
    expect(buttonByText('Copy')).toBeDefined()
    expect(buttonByText('Download .txt')).toBeDefined()
  })

  it('shares the list text when a share sheet is available', async () => {
    const share = mockShare(() => Promise.resolve())

    mountModal()
    buttonByText('Share')?.click()
    await vi.waitFor(() => expect(share).toHaveBeenCalled())

    expect(share).toHaveBeenCalledWith({ text: buildShoppingListText(out, low) })
  })

  it('treats a dismissed share sheet as a no-op', async () => {
    const aborted = Object.assign(new Error('Share canceled'), { name: 'AbortError' })
    mockShare(() => Promise.reject(aborted))

    mountModal()
    buttonByText('Share')?.click()
    await new Promise(resolve => setTimeout(resolve))

    expect(notifications.value).toEqual([])
  })

  it('copies the previewed text to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    mountModal()
    buttonByText('Copy')?.click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled())

    expect(writeText).toHaveBeenCalledWith(buildShoppingListText(out, low))
    expect(notifications.value.some(n => n.type === 'success')).toBe(true)
  })

  it('disables every action and explains itself when nothing is out or low', () => {
    mountModal({ out: [], low: [] })

    expect(document.body.querySelector('.shopping-list-preview')).toBeNull()
    expect(document.body.querySelector('.shopping-list-empty')?.textContent)
      .toContain('Nothing to restock')

    const actions = Array.from(document.body.querySelectorAll('.modal-actions button')) as HTMLButtonElement[]
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(button => button.disabled)).toBe(true)
  })
})
