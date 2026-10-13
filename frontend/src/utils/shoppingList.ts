import type { Drink } from '@beerswipe/types'

export const OUT_OF_STOCK_HEADING = '--- OUT OF STOCK ---'
export const LOW_STOCK_HEADING = '--- LOW STOCK ---'

type RestockableDrink = Pick<Drink, 'name' | 'stock'>

/**
 * Plain text restock list: out of stock first, then low stock, one drink per
 * line with its current count. Group headings double as the blank-line
 * separated sections; a group with nothing in it is left out entirely, so an
 * empty list yields an empty string.
 *
 * The caller passes the same `stockLevel()` groups the dashboard strip renders,
 * so the list can never disagree with what the strip shows.
 */
export const buildShoppingListText = (
  out: RestockableDrink[],
  low: RestockableDrink[]
): string => {
  const sections = [
    { heading: OUT_OF_STOCK_HEADING, drinks: out },
    { heading: LOW_STOCK_HEADING, drinks: low },
  ]

  return sections
    .filter(section => section.drinks.length > 0)
    .map(section =>
      [
        section.heading,
        ...section.drinks.map(drink => `${drink.name} (${drink.stock})`),
      ].join('\n')
    )
    .join('\n\n')
}

/**
 * `shopping-list-YYYY-MM-DD.txt` from the local calendar day: a list made at
 * 11pm belongs to that day, not to the UTC one.
 */
export const shoppingListFilename = (date: Date = new Date()): string => {
  const pad = (value: number): string => String(value).padStart(2, '0')

  return `shopping-list-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`
}
