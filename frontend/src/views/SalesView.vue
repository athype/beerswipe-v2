<template>
  <div class="sales-view">
    <div class="sales-header">
      <h1>Sales Terminal</h1>
      <p>Process drink sales and manage transactions</p>
    </div>

    <div class="sales-container">
      <!-- Customer Selection -->
      <div class="sales-section">
        <h2>Select Customer</h2>
        <div class="customer-search">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users by username..."
            @input="searchUsers"
          />
          <p v-if="searchQuery.length > 0 && searchQuery.length <= 2" class="search-hint">
            Type at least 3 characters to search
          </p>
          <div v-if="usersStore.loading" class="loading">Searching...</div>
          <p v-else-if="usersStore.error" class="list-error">{{ usersStore.error }}</p>
          <div v-else-if="filteredUsers.length > 0" class="user-list">
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="user-item"
              :class="{ selected: selectedUser?.id === user.id }"
              role="button"
              tabindex="0"
              :aria-pressed="selectedUser?.id === user.id ? 'true' : 'false'"
              @click="selectUser(user)"
              @keydown.enter="selectUser(user)"
              @keydown.space.prevent="selectUser(user)"
            >
              <div class="user-info">
                <span class="username">{{ user.username }}</span>
                <span class="user-type">{{ user.userType }}</span>
              </div>
              <div class="user-credits">{{ user.credits }} credits</div>
            </div>
          </div>
          <p v-else-if="searchQuery.length > 2" class="search-hint">
            No users found for "{{ searchQuery }}"
          </p>
        </div>

        <div v-if="selectedUser" class="selected-customer">
          <h3>Selected Customer</h3>
          <div class="customer-card">
            <div class="customer-info">
              <p><strong>{{ selectedUser.username }}</strong></p>
              <p>Type: {{ selectedUser.userType }}</p>
              <p class="credits">Credits: {{ selectedUser.credits }}</p>
              <div class="age-verification">
                <p v-if="userAge !== null" class="age-info">
                  Age: {{ userAge }} years old
                </p>
                <div class="alcohol-status" :class="{ 'can-serve': canServeAlcohol, 'cannot-serve': !canServeAlcohol }">
                  <svg
                    v-if="canServeAlcohol"
                    class="status-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 8.5l3.2 3.2L13 4.5"/>
                  </svg>
                  <svg
                    v-else
                    class="status-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M4 4l8 8M12 4l-8 8"/>
                  </svg>
                  <span class="status-text">
                    {{ canServeAlcohol ? 'Can serve alcohol' : 'Cannot serve alcohol (under 18)' }}
                  </span>
                </div>
              </div>
              <div class="customer-actions">
                <button @click="openAddCreditsModal" class="btn add-credits-btn">
                  <svg
                    class="btn-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="6.25"/>
                    <path d="M8 5v6M5 8h6"/>
                  </svg>
                  Add Credits
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Drink Selection -->
      <div class="sales-section">
        <h2>Select Drinks</h2>
        <div class="drinks-search">
          <input
            v-model="drinkSearchQuery"
            type="text"
            placeholder="Search drinks..."
            @input="searchDrinks"
          />
        </div>

        <p v-if="drinksStore.loading && availableDrinks.length === 0" class="loading">Loading drinks...</p>
        <p v-else-if="drinksStore.error" class="list-error">{{ drinksStore.error }}</p>
        <p v-else-if="availableDrinks.length === 0" class="list-empty">No drinks found</p>
        <div v-else class="drinks-grid">
          <div
            v-for="drink in availableDrinks"
            :key="drink.id"
            class="drink-card"
            :class="{ blocked: isAlcoholBlocked(drink) }"
            role="button"
            tabindex="0"
            :aria-label="`Add ${drink.name} to cart`"
            @click="addToCart(drink)"
            @keydown.enter="addToCart(drink)"
            @keydown.space.prevent="addToCart(drink)"
          >
            <div class="drink-info">
              <h4>
                {{ drink.name }}
                <span v-if="drink.isAlcohol" class="alcohol-tag">18+</span>
              </h4>
              <p class="drink-price">{{ drink.price }} credits</p>
              <p class="drink-stock">{{ drink.stock }} in stock</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Shopping Cart -->
      <div class="sales-section">
        <h2>Cart</h2>
        <div v-if="cart.length === 0" class="empty-cart">
          Cart is empty
        </div>
        <div v-else>
          <div
            v-for="item in cart"
            :key="item.drink.id"
            class="cart-item"
          >
            <div class="item-info">
              <span class="item-name">{{ item.drink.name }}</span>
              <span class="item-price">{{ item.drink.price }} credits each</span>
            </div>
            <div class="item-controls">
              <button
                @click="decreaseQuantity(item)"
                class="qty-btn"
                :disabled="item.quantity <= 1"
                :aria-label="`Decrease ${item.drink.name} quantity`"
              >−</button>
              <span class="quantity">{{ item.quantity }}</span>
              <button
                @click="increaseQuantity(item)"
                class="qty-btn"
                :aria-label="`Increase ${item.drink.name} quantity`"
              >+</button>
              <button
                @click="removeFromCart(item)"
                class="remove-btn"
                :aria-label="`Remove ${item.drink.name} from cart`"
              >Remove</button>
            </div>
          </div>
          
          <div class="cart-summary">
            <div class="total">
              <strong>Total: {{ totalCost }} credits</strong>
            </div>
            <div class="actions">
              <button @click="clearCart" class="btn clear-btn" :disabled="processing">Clear Cart</button>
              <button
                @click="openConfirmModal"
                :disabled="!selectedUser || cart.length === 0 || selectedUser.credits < totalCost || processing"
                class="btn checkout-btn"
              >
                {{ processing ? 'Processing…' : 'Process Sale' }}
              </button>
            </div>
            <p v-if="checkoutHint" class="checkout-hint">{{ checkoutHint }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Credits Modal -->
    <AddCreditsModal
      :show="showCreditsModal"
      :user="selectedUser"
      @close="closeCreditsModal"
      @success="handleCreditsSuccess"
    />

    <!-- Sale Confirm Modal -->
    <SaleConfirmModal
      :show="showConfirmModal"
      :user="selectedUser"
      :items="cart"
      :total="totalCost"
      :processing="processing"
      @close="closeConfirmModal"
      @confirm="confirmSale"
    />

    <!-- Recent Sales -->
    <div class="recent-sales">
      <h2>Recent Sales</h2>
      <div v-if="salesStore.loading" class="loading">Loading recent sales...</div>
      <div v-else-if="recentSales.length === 0" class="no-sales">
        No recent sales
      </div>
      <div v-else class="sales-list">
        <div
          v-for="sale in recentSales"
          :key="sale.id"
          class="sale-item"
        >
          <div class="sale-info">
            <span class="sale-description">{{ sale.description }}</span>
            <span class="sale-user">{{ sale.user?.username }}</span>
          </div>
          <div class="sale-amount">{{ sale.amount }} credits</div>
          <div class="sale-time">{{ formatTime(sale.transactionDate) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useNotifications } from '@/composables/useNotifications'
import { useUsersStore } from '../stores/users'
import { useDrinksStore } from '../stores/drinks'
import { useSalesStore } from '../stores/sales'
import AddCreditsModal from '../components/AddCreditsModal.vue'
import SaleConfirmModal from '../components/modals/SaleConfirmModal.vue'

const usersStore = useUsersStore()
const drinksStore = useDrinksStore()
const salesStore = useSalesStore()
const { showSuccess, showError } = useNotifications()

const searchQuery = ref('')
const drinkSearchQuery = ref('')
const selectedUser = ref(null)
const cart = ref([])
const showCreditsModal = ref(false)
const showConfirmModal = ref(false)
const processing = ref(false)

const filteredUsers = computed(() => {
  if (!searchQuery.value) return []
  return usersStore.users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
    user.userType !== 'admin'
  )
})

const availableDrinks = computed(() => {
  const query = drinkSearchQuery.value.toLowerCase()
  return drinksStore.availableDrinks.filter(drink =>
    drink.name.toLowerCase().includes(query)
  )
})

const totalCost = computed(() => {
  return cart.value.reduce((total, item) => total + (item.drink.price * item.quantity), 0)
})

const recentSales = computed(() => {
  return salesStore.transactions.filter(t => t.type === 'sale').slice(0, 10)
})

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null
  
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1
  }
  
  return age
}

const canServeAlcohol = computed(() => {
  const age = calculateAge(selectedUser.value?.dateOfBirth)
  return age !== null && age >= 18
})

const userAge = computed(() => {
  return calculateAge(selectedUser.value?.dateOfBirth)
})

const isAlcoholBlocked = (drink) => {
  return drink.isAlcohol && !canServeAlcohol.value
}

const alcoholRefusalReason = (drink) => {
  if (!drink.isAlcohol) return null
  if (!selectedUser.value) {
    return 'Select a customer first — alcohol (18+) requires an age check'
  }
  if (userAge.value === null) {
    return `${selectedUser.value.username} has no date of birth on file — cannot sell alcohol (18+)`
  }
  return `${selectedUser.value.username} is under 18 — cannot sell alcohol (18+)`
}

const cartHasBlockedAlcohol = computed(() => {
  return cart.value.some(item => isAlcoholBlocked(item.drink))
})

const checkoutHint = computed(() => {
  if (!selectedUser.value) return 'Select a customer to start a sale'
  if (cart.value.length === 0) return 'Add drinks to the cart'
  if (selectedUser.value.credits < totalCost.value) {
    const missing = totalCost.value - selectedUser.value.credits
    return `${selectedUser.value.username} has ${selectedUser.value.credits} credits — ${missing} more needed`
  }
  return null
})

let searchUsersTimer = null
const searchUsers = () => {
  clearTimeout(searchUsersTimer)
  searchUsersTimer = setTimeout(async () => {
    if (searchQuery.value.length > 2) {
      await usersStore.fetchUsers({ search: searchQuery.value })
    }
  }, 300)
}

let searchDrinksTimer = null
const searchDrinks = () => {
  clearTimeout(searchDrinksTimer)
  searchDrinksTimer = setTimeout(async () => {
    await drinksStore.fetchDrinks({ search: drinkSearchQuery.value, inStock: true })
  }, 300)
}

const selectUser = (user) => {
  selectedUser.value = user
}

const addToCart = (drink) => {
  if (processing.value) return
  if (isAlcoholBlocked(drink)) {
    showError(alcoholRefusalReason(drink))
    return
  }
  const existingItem = cart.value.find(item => item.drink.id === drink.id)
  if (existingItem) {
    if (existingItem.quantity < drink.stock) {
      existingItem.quantity++
    }
  } else {
    cart.value.push({ drink, quantity: 1 })
  }
}

const increaseQuantity = (item) => {
  if (processing.value) return
  if (item.quantity < item.drink.stock) {
    item.quantity++
  }
}

const decreaseQuantity = (item) => {
  if (processing.value) return
  if (item.quantity > 1) {
    item.quantity--
  }
}

const removeFromCart = (item) => {
  if (processing.value) return
  const index = cart.value.findIndex(cartItem => cartItem.drink.id === item.drink.id)
  if (index > -1) {
    cart.value.splice(index, 1)
  }
}

const clearCart = () => {
  if (processing.value) return
  cart.value = []
}

const openConfirmModal = () => {
  if (processing.value || !selectedUser.value || cart.value.length === 0) return
  if (cartHasBlockedAlcohol.value) {
    showError('The cart contains alcohol (18+) and this customer cannot be served — remove it before charging')
    return
  }
  showConfirmModal.value = true
}

const closeConfirmModal = () => {
  if (!processing.value) {
    showConfirmModal.value = false
  }
}

const confirmSale = async () => {
  if (!selectedUser.value || cart.value.length === 0 || processing.value) return

  processing.value = true
  const currentUser = selectedUser.value
  const currentCart = [...cart.value]
  const failedItems = []
  let soldAmount = 0

  try {
    for (const item of currentCart) {
      const result = await salesStore.makeSale({
        userId: currentUser.id,
        drinkId: item.drink.id,
        quantity: item.quantity
      })

      if (result.success) {
        soldAmount += item.drink.price * item.quantity
        // Remove the sold item — the cart keeps whatever failed so the sale can be retried
        const index = cart.value.findIndex(cartItem => cartItem.drink.id === item.drink.id)
        if (index > -1) {
          cart.value.splice(index, 1)
        }
      } else {
        failedItems.push({ name: item.drink.name, error: result.error || 'Failed to process sale' })
      }
    }

    if (failedItems.length > 0) {
      showError(`Sale incomplete — ${failedItems.map(f => `${f.name}: ${f.error}`).join('; ')}`)
    } else {
      showSuccess(`Sale processed successfully — ${soldAmount} credits`)
    }
  } catch (error) {
    // Network-level failure: nothing was charged, keep the cart and customer so the sale can be retried
    showError('Failed to process sale — nothing was charged, please retry')
  } finally {
    processing.value = false
  }

  await Promise.all([
    drinksStore.fetchDrinks({ inStock: true }),
    salesStore.fetchTransactionHistory({ limit: 10 })
  ])

  if (failedItems.length > 0) {
    // Refresh balances so the remaining cart can be re-checked against authoritative credits
    const result = await usersStore.fetchUsers({})
    if (result.success) {
      const refreshed = usersStore.users.find(u => u.id === currentUser.id)
      if (refreshed) {
        selectedUser.value = refreshed
      }
    }
  } else if (soldAmount > 0) {
    selectedUser.value = null
    searchQuery.value = ''
    showConfirmModal.value = false
  }
}

const openAddCreditsModal = () => {
  showCreditsModal.value = true
}

const handleCreditsSuccess = () => {
  closeCreditsModal()
}

const closeCreditsModal = () => {
  showCreditsModal.value = false
}

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(async () => {
  await Promise.all([
    drinksStore.fetchDrinks({ inStock: true }),
    salesStore.fetchTransactionHistory({ limit: 10 })
  ])
})
</script>

<style scoped>
.sales-view {
  max-width: 1400px;
  margin: 0 auto;
}

.sales-header {
  margin-bottom: 2rem;
}

.sales-header h1 {
  font-size: var(--font-size-4xl);
  margin-bottom: 0.5rem;
}

.sales-container {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
}

.sales-section {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--green-7);
  padding: var(--spacing-xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  transition: all 0.3s ease;
}

.sales-section h2 {
  color: var(--green-12);
  margin-bottom: 1.5rem;
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.customer-search input,
.drinks-search input {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--green-7);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  background: rgba(34, 34, 34, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-light-grey);
  transition: all 0.3s ease;
}

.customer-search input:focus,
.drinks-search input:focus {
  outline: none;
  border-color: var(--green-9);
  background: rgba(34, 34, 34, 0.7);
  box-shadow: 0 0 0 3px rgba(5, 94, 104, 0.2);
}

.user-list {
  max-height: 300px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(34, 34, 34, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.user-item:hover {
  border-color: var(--green-7);
  background: rgba(34, 34, 34, 0.5);
}

.user-item.selected {
  background: var(--green-3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--color-white);
  border-color: var(--green-7);
  box-shadow: var(--shadow-glass);
}

.user-info {
  display: flex;
  flex-direction: column;
}

.username {
  font-weight: 500;
}

.user-type {
  font-size: 0.9rem;
  opacity: 0.8;
}

.user-credits {
  font-weight: bold;
}

.selected-customer {
  margin-top: 1rem;
}

.customer-card {
  color: var(--color-light-grey);
  background: rgba(34, 34, 34, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.credits {
  color: var(--green-11);
  font-weight: bold;
}

.age-verification {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--glass-border);
}

.age-info {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--color-grey);
}

.alcohol-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
}

.alcohol-status.can-serve {
  background: rgba(40, 167, 69, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-white);
  border: 1px solid var(--green-7);
}

.alcohol-status.cannot-serve {
  background: rgba(220, 53, 69, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-white);
  border: 1px solid var(--red-7);
}

.status-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.status-text {
  flex: 1;
}

.customer-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--glass-border);
}

.add-credits-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--green-3);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  width: 100%;
  transition: background 0.3s ease;
}

.add-credits-btn:hover:not(:disabled) {
  background: var(--green-5);
}

.btn-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.drinks-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.drink-card {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(34, 34, 34, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.drink-card:hover {
  border-color: var(--green-7);
  background: rgba(34, 34, 34, 0.5);
  box-shadow: 0 4px 12px rgba(5, 94, 104, 0.2);
}

.drink-info h4 {
  margin-bottom: 0.5rem;
  color: var(--color-light-grey);
}

.alcohol-tag {
  display: inline-block;
  margin-left: 0.375rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(220, 53, 69, 0.3);
  border: 1px solid rgba(220, 53, 69, 0.6);
  font-size: var(--font-size-sm);
  font-weight: 600;
  vertical-align: middle;
}

.drink-card.blocked {
  opacity: 0.55;
  cursor: not-allowed;
}

.drink-price {
  color: var(--green-11);
  font-weight: bold;
}

.drink-stock {
  color: var(--color-grey);
  font-size: 0.9rem;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  background: rgba(34, 34, 34, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

.cart-item:hover {
  background: rgba(34, 34, 34, 0.5);
  border-color: var(--green-7);
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-weight: 500;
}

.item-price {
  font-size: 0.9rem;
  color: var(--green-11);
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  background: var(--gray-7);
  color: var(--color-white);
  border: none;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: bold;
  font-size: var(--font-size-xl);
  transition: background 0.3s ease;
}

.qty-btn:hover:not(:disabled) {
  background: var(--gray-9);
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quantity {
  min-width: 40px;
  text-align: center;
  font-weight: bold;
}

.remove-btn {
  background: rgba(220, 53, 69, 0.8);
  border: 1px solid rgba(220, 53, 69, 0.4);
  color: white;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background 0.3s ease;
}

.remove-btn:hover:not(:disabled) {
  background: var(--red-9);
  border-color: var(--color-error);
}

.cart-summary {
  border-top: 1px solid var(--glass-border);
  padding-top: 1rem;
  margin-top: 1rem;
}

.total {
  margin-bottom: 1rem;
  font-size: var(--font-size-xl);
  color: var(--green-11);
}

.actions {
  display: flex;
  gap: 1rem;
}

.clear-btn {
  background: var(--gray-7);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
}
.clear-btn:hover:not(:disabled) {
  background: var(--gray-9);
}

.checkout-btn {
  background: rgba(50, 124, 85, 0.8);
  border: 1px solid var(--green-7);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  flex: 1;
  transition: all 0.3s ease;
}
.checkout-btn:hover:not(:disabled) {
  background: rgba(50, 124, 85, 1);
  border-color: var(--green-9);
  box-shadow: var(--shadow-lg);
}

.checkout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.recent-sales {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--green-7);
  padding: var(--spacing-xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  transition: all 0.3s ease;
}

.recent-sales h2 {
  color: var(--green-12);
  margin-bottom: 1.5rem;
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.sale-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--glass-border);
  align-items: center;
}

.sale-info {
  display: flex;
  flex-direction: column;
}

.sale-description {
  font-weight: 500;
}

.sale-user {
  font-size: 0.9rem;
  color: var(--color-grey);
}

.sale-amount {
  font-weight: bold;
  color: var(--green-11);
}

.sale-time {
  color: var(--color-grey);
  font-size: 0.9rem;
}

.empty-cart,
.no-sales,
.loading {
  text-align: center;
  color: var(--color-grey);
  padding: 2rem;
}

.search-hint,
.list-empty,
.checkout-hint {
  font-size: 0.9rem;
  color: var(--color-grey);
}

.search-hint {
  margin: -0.5rem 0 0.75rem;
}

.list-empty {
  margin: 1rem 0;
  text-align: center;
}

.list-error {
  font-size: 0.9rem;
  color: var(--red-9);
  margin-bottom: 0.75rem;
}

.checkout-hint {
  margin-top: 0.75rem;
}

.user-item:focus-visible,
.drink-card:focus-visible {
  outline: 2px solid var(--green-9);
  outline-offset: 2px;
}

@media (max-width: 1024px) {
  .sales-container {
    grid-template-columns: 1fr;
  }

  .drinks-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 420px) {
  .drinks-grid {
    grid-template-columns: 1fr;
  }
}
</style>
