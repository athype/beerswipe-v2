import type { Drink } from '@beerswipe/types'

export const LOW_STOCK_THRESHOLD = 10

export type StockLevel = 'out' | 'low' | 'ok'

export const stockLevel = (drink: Pick<Drink, 'stock'>): StockLevel => {
  if (drink.stock <= 0) return 'out'
  if (drink.stock <= LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}
