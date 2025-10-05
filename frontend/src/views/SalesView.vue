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
          <div v-if="usersStore.loading" class="loading">Searching...</div>
          <div v-if="filteredUsers.length > 0" class="user-list">
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="user-item"
              :class="{ selected: selectedUser?.id === user.id }"
              @click="selectUser(user)"
            >
              <div class="user-info">
                <span class="username">{{ user.username }}</span>
                <span class="user-type">{{ user.userType }}</span>
              </div>
              <div class="user-credits">{{ user.credits }} credits</div>
            </div>
          </div>
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
                  <span class="status-icon">{{ canServeAlcohol ? '✅' : '🚫' }}</span>
                  <span class="status-text">
                    {{ canServeAlcohol ? 'Can serve alcohol' : 'Cannot serve alcohol (under 18)' }}
                  </span>
                </div>
              </div>
              <div class="customer-actions">
                <button @click="openAddCreditsModal" class="add-credits-btn">
                  💰 Add Credits
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
        
        <div class="drinks-grid">
          <div
            v-for="drink in availableDrinks"
            :key="drink.id"
            class="drink-card"
            @click="addToCart(drink)"
          >
            <div class="drink-info">
              <h4>{{ drink.name }}</h4>
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
              <button @click="decreaseQuantity(item)" class="qty-btn">-</button>
              <span class="quantity">{{ item.quantity }}</span>
              <button @click="increaseQuantity(item)" class="qty-btn">+</button>
              <button @click="removeFromCart(item)" class="remove-btn">Remove</button>
            </div>
          </div>
          
          <div class="cart-summary">
            <div class="total">
              <strong>Total: {{ totalCost }} credits</strong>
            </div>
            <div class="actions">
              <button @click="clearCart" class="clear-btn">Clear Cart</button>
              <button 
                @click="processeSale" 
                :disabled="!selectedUser || cart.length === 0 || selectedUser.credits < totalCost"
                class="checkout-btn"
              >
                Process Sale
              </button>
            </div>
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

    <!-- Recent Sales -->
    <div class="recent-sales">
      <h2>Recent Sales</h2>
      <div v-if="recentSales.length === 0" class="no-sales">
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
import { useNotifications } from '@/composables/useNotifications.js'
import { useUsersStore } from '../stores/users.js'
import { useDrinksStore } from '../stores/drinks.js'
import { useSalesStore } from '../stores/sales.js'
import AddCreditsModal from '../components/AddCreditsModal.vue'

const usersStore = useUsersStore()
const drinksStore = useDrinksStore()
const salesStore = useSalesStore()
const { showSuccess, showError } = useNotifications()

const searchQuery = ref('')
const drinkSearchQuery = ref('')
const selectedUser = ref(null)
const cart = ref([])
const showCreditsModal = ref(false)

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

const searchUsers = async () => {
  if (searchQuery.value.length > 2) {
    await usersStore.fetchUsers({ search: searchQuery.value })
  }
}

const searchDrinks = async () => {
  await drinksStore.fetchDrinks({ search: drinkSearchQuery.value, inStock: true })
}

const selectUser = (user) => {
  selectedUser.value = user
}

const addToCart = (drink) => {
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
  if (item.quantity < item.drink.stock) {
    item.quantity++
  }
}

const decreaseQuantity = (item) => {
  if (item.quantity > 1) {
    item.quantity--
  } else {
    removeFromCart(item)
  }
}

const removeFromCart = (item) => {
  const index = cart.value.findIndex(cartItem => cartItem.drink.id === item.drink.id)
  if (index > -1) {
    cart.value.splice(index, 1)
  }
}

const clearCart = () => {
  cart.value = []
}

const processeSale = async () => {
  if (!selectedUser.value || cart.value.length === 0) return

  const currentUser = selectedUser.value
  const currentCart = [...cart.value]
  const cost = totalCost.value

  clearCart()
  selectedUser.value = null
  searchQuery.value = ''

  try {
    for (const item of currentCart) {
      const result = await salesStore.makeSale({
        userId: currentUser.id,
        drinkId: item.drink.id,
        quantity: item.quantity
      })

      if (!result.success) {
        showError(result.error || 'Failed to process sale')
        return
      }
    }
    
    const userIndex = usersStore.users.findIndex(u => u.id === currentUser.id)
    if (userIndex !== -1) {
      usersStore.users[userIndex].credits -= cost
    }

    await Promise.all([
      drinksStore.fetchDrinks(),
      salesStore.fetchTransactionHistory({ limit: 10 })
    ])

    showSuccess('Sale processed successfully!')
  } catch (error) {
    showError('Failed to process sale')
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
  color: var(--color-teal);
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
  border: 1px solid var(--glass-border-accent);
  padding: var(--spacing-xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  transition: all 0.3s ease;
}

.sales-section:hover {
  transform: translateY(-2px);
}

.sales-section h2 {
  color: var(--color-light-grey);
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.customer-search input,
.drinks-search input {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--glass-border);
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
  border-color: var(--color-teal);
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
  border-color: var(--color-teal);
  background: rgba(34, 34, 34, 0.5);
  transform: translateX(4px);
}

.user-item.selected {
  background: rgba(5, 94, 104, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--color-white);
  border-color: var(--color-teal);
  box-shadow: 0 4px 12px rgba(5, 94, 104, 0.3);
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
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.credits {
  color: var(--color-teal);
  font-weight: bold;
}

.age-verification {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e1e1e1;
}

.age-info {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #495057;
}

.alcohol-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.alcohol-status.can-serve {
  background: rgba(40, 167, 69, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-white);
  border: 1px solid rgba(40, 167, 69, 0.5);
}

.alcohol-status.cannot-serve {
  background: rgba(220, 53, 69, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-white);
  border: 1px solid rgba(220, 53, 69, 0.5);
}

.status-icon {
  font-size: 1rem;
}

.status-text {
  flex: 1;
}

.customer-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e1e1e1;
}

.add-credits-btn {
  background: var(--color-green);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  width: 100%;
  transition: background 0.3s ease;
}

.add-credits-btn:hover {
  background: #4cae4c;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-card-bg);
  padding: 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal h2 {
  color: var(--color-light-grey);
  margin-bottom: 1.5rem;
  text-align: center;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-light-grey);
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-teal);
}

.current-credits {
  background: var(--color-teal);
  color: white;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-weight: 500;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.3s ease;
}

.btn.primary {
  background: var(--color-green);
  color: white;
  flex: 1;
}

.btn.primary:hover {
  background: #4cae4c;
}

.btn.secondary {
  background: #6c757d;
  color: white;
}

.btn.secondary:hover {
  background: #545b62;
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
  border-color: var(--color-teal);
  background: rgba(34, 34, 34, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(5, 94, 104, 0.2);
}

.drink-info h4 {
  margin-bottom: 0.5rem;
  color: var(--color-light-grey);
}

.drink-price {
  color: var(--color-teal);
  font-weight: bold;
}

.drink-stock {
  color: #7f8c8d;
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
  border-color: var(--color-teal);
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
  color: #7f8c8d;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  background: #e9ecef;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.quantity {
  min-width: 30px;
  text-align: center;
  font-weight: bold;
}

.remove-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.cart-summary {
  border-top: 1px solid #e1e1e1;
  padding-top: 1rem;
  margin-top: 1rem;
}

.total {
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.clear-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

.checkout-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  flex: 1;
}

.checkout-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.recent-sales {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border-accent);
  padding: var(--spacing-xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  transition: all 0.3s ease;
}

.recent-sales:hover {
  background: var(--glass-bg-dark);
  border-color: var(--color-teal);
}

.recent-sales h2 {
  color: var(--color-light-grey);
  margin-bottom: 1.5rem;
}

.sale-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e1e1e1;
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
  color: #7f8c8d;
}

.sale-amount {
  font-weight: bold;
  color: var(--color-teal);
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

@media (max-width: 1024px) {
  .sales-container {
    grid-template-columns: 1fr;
  }
}
</style>
