import { describe, expect, it } from 'vitest'
import {
  LOW_STOCK_HEADING,
  OUT_OF_STOCK_HEADING,
  buildShoppingListText,
  shoppingListFilename
} from '../shoppingList'

const drink = (name: string, stock: number) => ({ name, stock })

describe('buildShoppingListText', () => {
  it('lists out of stock before low stock, one drink per line with its count', () => {
    const text = buildShoppingListText(
      [drink('Cola', 0), drink('Spa Blauw', 0)],
      [drink('Heineken 0.0', 2), drink('Ice Tea Green', 4)]
    )

    expect(text).toBe([
      OUT_OF_STOCK_HEADING,
      'Cola (0)',
      'Spa Blauw (0)',
      '',
      LOW_STOCK_HEADING,
      'Heineken 0.0 (2)',
      'Ice Tea Green (4)'
    ].join('\n'))
  })

  it('leaves out the heading of a group with nothing in it', () => {
    expect(buildShoppingListText([], [drink('Cola', 3)]))
      .toBe(`${LOW_STOCK_HEADING}\nCola (3)`)

    expect(buildShoppingListText([drink('Cola', 0)], []))
      .toBe(`${OUT_OF_STOCK_HEADING}\nCola (0)`)
  })

  it('keeps the order the groups arrive in, matching the strip', () => {
    const text = buildShoppingListText([drink('Zero', 0), drink('Alpha', 0)], [])

    expect(text.split('\n').slice(1)).toEqual(['Zero (0)', 'Alpha (0)'])
  })

  it('is empty when nothing is out of stock or low', () => {
    expect(buildShoppingListText([], [])).toBe('')
  })
})

describe('shoppingListFilename', () => {
  it('zero pads the date and ends in .txt', () => {
    expect(shoppingListFilename(new Date(2026, 0, 5))).toBe('shopping-list-2026-01-05.txt')
    expect(shoppingListFilename(new Date(2026, 10, 30))).toBe('shopping-list-2026-11-30.txt')
  })

  it('uses the local calendar day, not the UTC one', () => {
    expect(shoppingListFilename(new Date(2025, 11, 31, 23, 30))).toBe('shopping-list-2025-12-31.txt')
  })
})
