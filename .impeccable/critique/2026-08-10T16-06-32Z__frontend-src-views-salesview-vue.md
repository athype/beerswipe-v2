---
target: critique the sales page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-10T16-06-32Z
slug: frontend-src-views-salesview-vue
---
# Design Critique Re-run: Sales Terminal (`frontend/src/views/SalesView.vue`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading/processing/hints/toasts solid, but a failed recent-sales fetch silently renders "No recent sales" and the serial charge loop shows no per-item progress |
| 2 | Match System / Real World | 3 | Plain bar language throughout; "Cannot serve alcohol (under 18)" mislabels no-DOB customers who are not under 18 (SalesView.vue:87, SaleConfirmModal.vue:26) |
| 3 | User Control and Freedom | 2 | Cancel/Esc/overlay everywhere, but no undo at the terminal (admin-only in history) and cart + customer vanish on refresh/navigation |
| 4 | Consistency and Standards | 3 | Token system coherent; `.user-credits` breaks Mint-Is-Money, modal unit price unminted, duplicate `calculateAge` |
| 5 | Error Prevention | 4 | Triple-layer legal gate (dimmed cards → modal refusal → server 403), double-submit-proof processing, qty bounded by stock and 1, credits pre-checked with deficit hint |
| 6 | Recognition Rather Than Recall | 2 | Good autocomplete and hints, but no recent-customer recall — the volunteer re-types a student number every round |
| 7 | Flexibility and Efficiency | 2 | Enter/Space on cards, 40px buttons, debounce — but no search shortcut, no repeat order, and a 5-item cart is 5 serial HTTPS+DB round trips |
| 8 | Aesthetic and Minimalist Design | 3 | Clean glass/green world; the wall of 50 drink cards is the main visual noise |
| 9 | Error Recovery | 3 | Failures kept in cart with reasons, "nothing was charged" on network failure, balances refreshed before retry; no terminal undo |
| 10 | Help and Documentation | 2 | The checkout hint is genuinely good contextual help; blocked cards explain why only after a wasted tap |
| **Total** | | **27/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment.** The page is now authored for THIS product. The 18+ legal gate is the spine, not a sticker: per-drink blocking with named refusal reasons ("piet is under 18"), a persistent serve-status chip in the customer card, a modal-level guard, and a server-side 403 with per-condition error text. Mint money threads through prices, balances, totals. The checkout hint doing the credit arithmetic for the volunteer ("piet has 12 credits — 5 more needed") is bar-line thinking no generic POS would have. Residual interchangeability lives in scaffolding (drink rows, recent-sales table, "Cart"/"Process Sale" copy), but the decisions around them are product-native and the Bottle Glow tokens are applied consistently. Not category-interchangeable where it matters.

**Deterministic scan.** Detector exit 2: 12 findings (down from 20). SalesView.vue: 1; SaleConfirmModal: 0; AddCreditsModal: 0 (all 4 prior findings resolved); CreateEditDrinkModal: 1; DrinksView: 10. Per rule: color ×8, radius ×2, font-size ×2. Two false positives — both black-alpha box-shadows documented in DESIGN.md's shadow vocabulary (inset on `.customer-card`, card hover `0 12px 40px rgba(0,0,0,0.45)` verbatim in DESIGN.md). The 10 genuine remaining findings all live in DrinksView (admin page, outside the sales flow) except one radius in CreateEditDrinkModal. The sales core is detector-clean.

**Visual overlays.** Not available: no browser automation in this session; all evidence is static source analysis.

## Overall Impression

The P0s are dead and the score shows it: 14 → 27. What was a pretty shell over an unsafe machine is now a genuinely product-native flow — legal gate enforced in three layers, the charge moment deliberate and protected, money consistently mint. What remains is speed and recall (the bar-line P1s), one factual copy bug on the legal surface, and terminal recovery (undo, state persistence). The single biggest opportunity: stop making volunteers re-find what they just used — recall the last customer and the last round.

## What's Working

1. **The three-layer legal gate** — dimmed blocked cards, refusal toasts naming the customer and reason, modal guard, server 403. A legal obligation designed as a system: enforced everywhere, explained nowhere more than once.
2. **Charge protection** — confirm modal repeats customer/items/mint total; processing locks every exit; per-item charging keeps failures in the cart with reasons and re-fetches authoritative balances before retry; network failure explicitly says nothing was charged. Textbook high-stakes UX.
3. **The checkout hint** — "piet has 12 credits — 5 more needed" does the subtraction for a volunteer in a loud bar. The most product-specific copy on the page.

## Priority Issues

1. **[P1] The serve-status chip states a false legal fact for no-DOB customers.** What: the chip (SalesView.vue:87) and the confirm modal (SaleConfirmModal.vue:26) render "Cannot serve alcohol (under 18)" for customers with no date of birth on file — the same flow's refusal toast already says "no date of birth on file" correctly (SalesView.vue:332-334). Why: on a legal surface, the exact reason is the argument the volunteer has with a 30-year-old; "under 18" is untrue for most adults without a recorded DOB. Fix: three-state copy — "Can serve alcohol" / "Cannot serve alcohol: no DOB on file" / "Cannot serve alcohol: under 18". **Command: /impeccable clarify**
2. **[P1] The drink wall: up to 50 alphabetical cards, no categories, no count.** What: `.drinks-grid` renders the full in-stock list (API limit 50) with no grouping, category filter, or popular-sort. Why: the busiest decision point at the bar line forces a scroll mid-conversation; mis-taps rise; Miller's law broken (10-25 cards visible in the 400px window). Fix: category chips (≤4-6 visible) or frequent-drinks sort; the `Drink.category` field already exists and is unused in the terminal. **Command: /impeccable layout**
3. **[P1] No recent-customer recall.** What: the customer search starts empty every sale; `selectedUser` clears on success (SalesView.vue:488-490). Why: regulars buy every round; re-typing a student number costs seconds × queue length — directly against "The bar line wins" (PRODUCT.md principle 1). Fix: persistent chips of the last 4-5 served customers above the search; optionally "repeat last order". **Command: /impeccable shape**
4. **[P1] Cart and customer are volatile local state.** What: `cart` and `selectedUser` refs with no persistence. Why: a refresh, navigation (even to undo a mistake), or a browser crash mid-line destroys a built cart and selected customer — Riley's "silently loses data" case. Fix: session-persisted terminal state (sessionStorage or a terminal store), plus terminal undo. **Command: /impeccable harden**
5. **[P2] No undo/void at the terminal.** What: `/undo` is `requireAdmin` only (backend/src/api/sales.js:295) and lives in Transaction History; the terminal has no recovery. Why: a mis-charge is uncorrectable from the bar — a volunteer must leave the line; the product promises "zero arguments about what someone drank." Fix: last-sale undo with confirm in the terminal, seller-scoped. **Command: /impeccable harden**
6. **[P2] Modal a11y: no dialog semantics or focus management.** What: Modal.vue:4-29 — no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, or focus restore. Why: keyboard focus escapes into the page behind the confirm modal; screen readers don't announce the dialog mid-charge. Fix: dialog role + trap + restore + labelledby; announce "Processing…". **Command: /impeccable audit**

## Persona Red Flags

**Alex (power user):** no way to jump to search (no shortcut or autofocus); a 5-item round is 5 serial round trips, each with its own DB transaction — seconds of "Processing…" on a slow night; the 50-card alphabetical drink wall forces scrolling to Grolsch every single time; no repeat-last-order; quantity only via taps, no numeric entry. Abandonment risk at drink selection, not checkout.

**Sam (a11y-dependent):** the confirm modal has no dialog role, aria-modal, or focus trap — Tab escapes the charge dialog into the page behind; blocked drink cards are announced "Add X to cart" with no `aria-disabled` and no reason, so Enter fires a refusal toast a screen reader may never announce; qty +/− changes are silent (no aria-live); the "under 18" chip states the wrong reason for no-DOB customers.

**Casey (mobile):** below 1024px the three columns stack, burying cart and Process Sale at the bottom of a tall scroll — the charge action is out of the thumb zone; leaving the terminal (even briefly) loses the cart with no warning.

## Minor Observations

- `.user-credits` (SalesView.vue:631-633) is the only credit figure on the page not in mint — direct Mint-Is-Money violation; the confirm modal's "2 × 3" unit price is also unminted (SaleConfirmModal.vue:40).
- Dead import: `watch` imported at SalesView.vue:255 but never used.
- Shared store `loading` flags bleed across the page: while `addCredits` runs the search shows "Searching..."; while the sale loop runs, Recent Sales flickers to "Loading recent sales...".
- `calculateAge` duplicated verbatim (SalesView.vue:299-312, SaleConfirmModal.vue:100-113) — drift risk; one shared age function should own the rule.
- Copy pattern break: "Select Customer" / "Select Drinks" / "Cart" — the third header drops the verb.
- Recent sales has no error branch — a failed history fetch renders "No recent sales"; `sale.user?.username` can render blank for deleted users.
- After a successful sale the toast states the amount but not the customer's new balance — the one number the customer asks about is one search away.
- Clear Cart has no confirmation; a fat-finger empties a built round.
- `0.9rem` appears 10× in SalesView (off the documented ramp — detector gap); `.alcohol-tag` uses off-scale 0.375rem spacing.
- Primary-button inconsistency: the confirm modal's Process Sale is forest green (`--green-3`) while the cart's checkout button is the deep-green recipe — DESIGN.md is internally contradictory (Colors say forest is "primary button base"; Components say Deep Green 80%→100%), so the flow needs a ruling.
- DrinksView (admin, out of scope this run): 10 genuine drift findings — `#f39c12` → warning amber, `#e74c3c` → error red, `#c0392b` → signal red, `rgba(98,163,136,…)` from the off-palette legacy token `--color-green: #62A388` in main.css, pill-radius 20px status badge, off-ramp fonts. Queued for a future pass.

## Questions to Consider

1. Search-every-round is treated as a sacred step — what if the terminal kept the last customer's order and one tap re-served it? Is "bar line wins" better served by recall chips than by a faster search?
2. The age refusal is the most emotionally charged moment in the product — should the chip coach the volunteer ("ask for ID") instead of just stating the legal conclusion, which for no-DOB customers is also factually wrong?
3. A 5-item order costs 5 API round trips and 5 database transactions — should one sale be one request with atomic charge and partial-failure semantics, with the UI showing per-item progress?
