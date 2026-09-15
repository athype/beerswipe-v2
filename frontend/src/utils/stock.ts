export const LOW_STOCK_THRESHOLD = 10

export const stockLevel = (drink) => {
  if (drink.stock <= 0) return 'out'
  if (drink.stock <= LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}
