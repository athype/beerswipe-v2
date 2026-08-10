---
target: critique the sales page
total_score: 14
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-10T14-57-18Z
slug: frontend-src-views-salesview-vue
---
# Design Critique: Sales Terminal (`frontend/src/views/SalesView.vue`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | No processing state on Process Sale; "Searching..." text is the only loading affordance; "No recent sales" flashes before data arrives |
| 2 | Match System / Real World | 2 | "credits" language is domain-native, but money moves instantly with no register-style final check; age badge says one thing, the flow does another |
| 3 | User Control and Freedom | 1 | No undo in the terminal; cart and customer wiped before the API resolves, so any failure destroys the sale context |
| 4 | Consistency and Standards | 1 | Light-mode-era greys hard-coded against dark glass: `#e1e1e1` dividers (488, 534, 763, 826), `#e9ecef` qty buttons, `#e74c3c` Remove, `#6c757d` disabled; three different button systems in one view |
| 5 | Error Prevention | 1 | The 18+ check prevents nothing — under-18 and no-DOB customers can be sold alcohol end-to-end; double-tap on Process Sale charges twice |
| 6 | Recognition Rather Than Recall | 2 | Search-as-you-type is good, but no recent-customer quick-pick, no drink categories, unbounded scroll; sale context gone after processing |
| 7 | Flexibility and Efficiency | 2 | No shortcuts, no Enter-to-confirm, no quantity presets — six taps to sell six beers; qty steppers are one-unit-only |
| 8 | Aesthetic and Minimalist Design | 2 | Clean glass grid, but unbounded scroll lists, emoji icons, and stray pale-grey lines fight the quiet hierarchy |
| 9 | Error Recovery | 1 | Generic toasts ("Failed to process sale") with cart already gone; disabled checkout gives no reason; search has no empty or error state |
| 10 | Help and Documentation | 1 | Zero inline guidance for first-shift volunteers; the age rule is never explained; "must be multiple of 10" is the only help text in the app |
| **Total** | | **14/40** | **Poor — major UX overhaul required** |

## Design Specificity Verdict

**LLM assessment.** The skin is authored for Beer Machine; the experience is not. The view executes the Bottle Glow world on the surface: shadow-glass panels with 1px Bottle Green rims (`.sales-section`, 374-383), near-black canvas with orbs and noise, mint list prices, a 2.25rem page title. But strip the palette and this is a generic three-panel search-cart-checkout screen any merch booth or cafe counter could ship. The product-defining interactions are absent or unenforced: the 18+ check is an informational emoji pill that gates nothing, `Drink` carries no alcohol flag (`types/src/domain.ts`), there is no confirmation before charging, no undo in the terminal, and the cart total — the most load-bearing number — renders in default text while list prices are mint.

**Deterministic scan.** Detector exit 2: 20 advisory findings — design-system-color ×7 (incl. `#495057`, `#e74c3c`, `#4cae4c`), design-system-radius ×7 (all `6px` vs the 4/8/12/16 scale), design-system-font-size ×3. False positives: 3 black-alpha box-shadows/modal-overlay flagged as palette drift (documented shadow vocabulary is black-alpha; overlay is documented "black at 0.6"). The detector additionally surfaced `#4cae4c` in AddCreditsModal and confirmed the dead `.modal` style block; it missed `#62A388` (undocumented sage in `main.css`), the recurring `0.9rem` off-ramp, and the `#7f8c8d`/`#e1e1e1`/`#e9ecef` grays (manual static observations). The detector cannot see the P0 behavioral failures — only the LLM pass catches those.

**Visual overlays.** Not available: this session exposes no browser automation, so no in-page overlay was injected and no console evidence exists. All visual claims are static source analysis.

## Overall Impression

A gorgeous glass costume on a machine that isn't safe yet. The composition honors the night-bar world, but the two things the product promises — legal alcohol service and a line that moves fast — are exactly where the flow breaks: the age gate is theater, the charge is unprotected, and the money figure is the least legible number on the page. The biggest single opportunity: make the sale-ending moment a deliberate, informed, mint-lit decision instead of a blind tap.

## What's Working

1. **The desktop composition honors the world.** Three equal glass panels, Bottle Green rims, shadow-glass, mint list prices, a 2.25rem page title — on a landscape terminal this reads calm, legible, and unmistakably the dark-glass POS DESIGN.md promises. The structural bones match the "customer → drinks → cart" spec.
2. **Age and balance surface at the point of decision.** The selected-customer card (37-54) shows age, serve-eligibility, and credits in the same viewport as drinks and cart — the right information architecture for an inline 18+ check; it's the enforcement that's missing.
3. **In-stock-only plumbing is baked in.** `availableDrinks` filters `isActive && stock > 0` and `addToCart` caps at stock — sold-out stock can't be added, removing an entire class of checkout errors. The overdraw guard (`credits < totalCost`, :125) is computed correctly; it just needs to communicate itself.

## Priority Issues

1. **[P0] The 18+ gate is theater — underage customers can be sold alcohol.** `canServeAlcohol` (225-228) is computed and shown as a badge but consulted nowhere: `addToCart` (248-257) and the checkout disable (:125) ignore it, and `Drink` has no alcohol flag, so the system cannot even classify a drink. A no-DOB user is labeled "Cannot serve alcohol (under 18)" (:51) while being fully sellable-to. **Why**: the product's legal differentiator (PRODUCT.md principle 3, Dutch 18+ law) is an emoji. **Fix**: add `isAlcohol` to Drink; gate alcohol items for `canServeAlcohol === false` with an explicit refusal; mark alcohol drinks in the grid. **Command**: /impeccable harden
2. **[P0] Charging is instant, unconfirmed, and unprotected — double-tap double-charges.** "Process Sale" fires the per-item async loop with no confirm step, no `isProcessing` guard, no loading state — and the cart and customer are cleared *before* the request resolves (288-292). A mid-loop failure (item 2 of 3 rejected by a concurrent terminal) leaves a half-sold sale invisible; a failed sale destroys the customer context. **Fix**: disable + spinner while processing; restore cart/customer on failure; optionally a one-tap confirm showing customer, items, total. **Command**: /impeccable harden
3. **[P1] The total violates Mint-Is-Money at the exact decision moment.** `.total` (765-768) and `.item-price` (722-725, `#7f8c8d`) are not mint while `.drink-price` and `.sale-amount` are. At checkout — where the eye must land — the most important number is the least legible. **Fix**: total in Mint Bright at display weight; CountUp it per the system's stat motion. **Command**: /impeccable colorize
4. **[P1] Disabled checkout hides its reason.** The disable condition (no customer / empty cart / insufficient credits) gives no explanation — no helper text, no tooltip. A volunteer mid-line sees a dead button and doesn't know whether to search, add drinks, or top up. **Fix**: always-enabled button plus a context line ("Jan has 12 credits, total is 18 — add credits" with an inline top-up). **Command**: /impeccable clarify
5. **[P1] On phones the checkout is below the fold — the core flow breaks on the core device.** The 3-column grid stacks at ≤1024px (862-866) with the unbounded drinks list pushing Process Sale off-screen; the cart is invisible while adding drinks. **Fix**: sticky bottom cart bar with running total and charge button; dense 2-col drink grid with category chips. **Command**: /impeccable layout
6. **[P2] The terminal is keyboard- and screen-reader-inoperable.** `.user-item` and `.drink-card` are `div`-based click targets with no `role`/`tabindex`/key handling (21-27, 78-83); Modal has no focus trap or `aria-modal`; the age line is `#495057` on dark glass (~2.4:1). **Fix**: real buttons/roles, focus management, focus trap, contrast-corrected age text. **Command**: /impeccable harden

## Persona Red Flags

**Riley (stress tester — double-tap, slow network, concurrent terminals):** Process Sale double-fires with no guard → duplicate charge; per-keystroke searches race on slow bar Wi-Fi → stale results; a second terminal selling the last keg mid-loop fails item 2 of 3 after the cart was wiped; the optimistic credit patch can disagree with the server after a retry.

**Casey (distracted mobile user — one thumb, phone as terminal):** cart + Process Sale are a long scroll below the drinks list on ≤1024px; 30px qty buttons invite over-taps; "-" at quantity 1 silently deletes the drink; the success toast lands top-right under the thumb and is gone in 5s; every drink is the same full-width card, so the target drink takes hunting.

**Jordan (first-shift volunteer):** dead "Process Sale" with no reason; search that silently does nothing under 3 characters; blank space instead of "no users found"; a customer with no DOB labeled "under 18" — Jordan argues with a 30-year-old about being carded; the Add Credits modal rejects with a toast instead of inline validation.

## Minor Observations

- `processeSale` typo (124, 284) — the function that moves money is misspelled.
- Detector: 7× `6px` radius drift (L502, 542, 598, 613, 628, 780, 792 + AddCreditsModal 118, 133, 148); 3× font-size drift (L388 1.5rem, L756 0.8rem, L767 1.2rem); `#4cae4c` hover in AddCreditsModal L162.
- Manual: `#62A388` undocumented sage in `main.css` used by `.btn-primary`; `#e1e1e1` dividers ×5 in the view + AddCreditsModal; `0.9rem` off-ramp ×9; button spec drift (500 vs 600 weight, no min-height 40px); `.remove-btn` `#e74c3c` vs documented Error Red `#DC3545`; `.sales-view` max-width 1400px vs 1200px; `.user-item.selected` green shadow outside the black-alpha vocabulary.
- Dead code: the entire `.modal`/`.form-group`/`.btn` block (554-652) — the real modal is AddCreditsModal.vue, duplicating button styles a third way.
- "No recent sales" flashes before the onMounted fetch resolves; no loading state for the list.
- `filteredUsers` client-filters admins (191) — searching "admin" silently yields nothing.
- Age badge uses emoji + red/green tint with no colorblind-safe distinction beyond hue; ✅/🚫/💰 emoji render inconsistently across devices.
- Modal closes on overlay click with no guard — a stray tap loses the typed amount (resets to 10 on reopen).
- After a sale the drinks refetch but the user list doesn't (hence the manual credit patch) — balances can go stale when another terminal charges the same customer.

## Questions to Consider

1. What if the terminal worked like a bartender's till — search customer once, build the round, and end with one full-screen "Charge Jan 18 credits" moment showing customer, age badge, line items, and mint total, so the only decision at the end is yes/no?
2. Should the 18+ rule be enforced per-drink (alcohol flag + badge in the grid) or per-sale (whole cart gated on the customer's age)? The UI implies per-customer; the law is per-drink — which model does the bar actually need?
3. What would the flow look like if the cart were a sticky bottom bar on every viewport — customer anchor at top, charge button always in reach — so the bar-line principle is enforced by layout rather than desktop-only luck?
