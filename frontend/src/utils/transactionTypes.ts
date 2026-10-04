import type { TransactionType } from "@beerswipe/types";

// Single source of truth for how a transaction type is worded in the UI.
//
// Views must not branch on the type with a "not a sale" fallback: that silently
// mislabels every type added later, which is how `credit_adjustment` would have
// rendered as "Credit Addition" everywhere. The Record<> below is exhaustive,
// so adding a member to TransactionType fails the typecheck until it has a
// label here.
interface TransactionTypePresentation {
  /** Full label, for the transaction table and the undo confirmation. */
  label: string;
  /** Compact label, for dashboard badges. */
  shortLabel: string;
  /** Badge classes for the dashboard's badge convention. */
  dashboardBadgeClass: string;
}

const PRESENTATION: Record<TransactionType, TransactionTypePresentation> = {
  sale: {
    label: "🛒 Sale",
    shortLabel: "Sale",
    dashboardBadgeClass: "badge-success",
  },
  credit_addition: {
    label: "💰 Credit Addition",
    shortLabel: "Credit",
    dashboardBadgeClass: "badge-primary",
  },
  credit_adjustment: {
    label: "✏️ Credit Adjustment",
    shortLabel: "Adjustment",
    dashboardBadgeClass: "badge-primary",
  },
};

// Rows from an older server, or a type this build does not know yet, still get
// a readable label rather than an empty badge.
const UNKNOWN_PRESENTATION: TransactionTypePresentation = {
  label: "Transaction",
  shortLabel: "Transaction",
  dashboardBadgeClass: "badge-primary",
};

function presentationFor(type: string | null | undefined): TransactionTypePresentation {
  return PRESENTATION[type as TransactionType] ?? UNKNOWN_PRESENTATION;
}

export function transactionTypeLabel(type: string | null | undefined): string {
  return presentationFor(type).label;
}

export function transactionTypeShortLabel(type: string | null | undefined): string {
  return presentationFor(type).shortLabel;
}

export function transactionTypeDashboardBadgeClass(type: string | null | undefined): string {
  return presentationFor(type).dashboardBadgeClass;
}

/** Options for the transaction history type filter. */
export const TRANSACTION_TYPE_FILTER_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "sale", label: "Sales" },
  { value: "credit_addition", label: "Credit Additions" },
  { value: "credit_adjustment", label: "Credit Adjustments" },
];

/**
 * The change undoing a transaction makes to the user's balance. Undo always
 * reverses the original effect, so the sign is the interesting part: undoing a
 * sale gives credits back, while undoing a credit addition or a balance edit
 * takes them away — and an edit may have lowered the balance, in which case
 * undoing it gives credits back. Callers use this to word confirmations and
 * toasts in the right direction instead of assuming a deduction.
 */
export function undoCreditDelta(
  transaction: { type: string; amount: number } | null | undefined,
): number {
  if (!transaction) {
    return 0;
  }
  return transaction.type === "sale" ? transaction.amount : -transaction.amount;
}
