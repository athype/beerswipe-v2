import { describe, expect, it } from 'vitest'
import {
  TRANSACTION_TYPE_FILTER_OPTIONS,
  transactionTypeDashboardBadgeClass,
  transactionTypeLabel,
  transactionTypeShortLabel,
  undoCreditDelta
} from '../transactionTypes'

describe('transactionTypes', () => {
  it('labels every known transaction type distinctly', () => {
    const labels = ['sale', 'credit_addition', 'credit_adjustment'].map(transactionTypeLabel)

    expect(labels.every(label => typeof label === 'string' && label.length > 0)).toBe(true)
    expect(new Set(labels).size).toBe(3)
  })

  it('falls back to a readable label for an unknown type', () => {
    expect(transactionTypeLabel('something_new')).toBe('Transaction')
    expect(transactionTypeShortLabel(undefined)).toBe('Transaction')
    expect(transactionTypeDashboardBadgeClass(null)).toBe('badge-primary')
  })

  it('offers every type as a history filter option', () => {
    expect(TRANSACTION_TYPE_FILTER_OPTIONS.map(option => option.value)).toEqual([
      'sale',
      'credit_addition',
      'credit_adjustment'
    ])
  })

  describe('undoCreditDelta', () => {
    it('gives credits back when undoing a sale', () => {
      expect(undoCreditDelta({ type: 'sale', amount: 20 })).toBe(20)
    })

    it('takes credits away when undoing a credit addition', () => {
      expect(undoCreditDelta({ type: 'credit_addition', amount: 20 })).toBe(-20)
    })

    it('takes credits away when undoing a balance that was raised', () => {
      expect(undoCreditDelta({ type: 'credit_adjustment', amount: 40 })).toBe(-40)
    })

    it('gives credits back when undoing a balance that was lowered', () => {
      // The amount is signed, so a negative adjustment reverses into a credit.
      expect(undoCreditDelta({ type: 'credit_adjustment', amount: -30 })).toBe(30)
    })

    it('is zero when there is no transaction', () => {
      expect(undoCreditDelta(null)).toBe(0)
      expect(undoCreditDelta(undefined)).toBe(0)
    })
  })
})
