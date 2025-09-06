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
import { useUsersStore } from '../stores/users.js'
import { useDrinksStore } from '../stores/drinks.js'
import { useSalesStore } from '../stores/sales.js'

const usersStore = useUsersStore()
const drinksStore = useDrinksStore()
const salesStore = useSalesStore()

const searchQuery = ref('')
const drinkSearchQuery = ref('')
const selectedUser = ref(null)
const cart = ref([])

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

  for (const item of cart.value) {
    const result = await salesStore.makeSale({
      userId: selectedUser.value.id,
      drinkId: item.drink.id,
      quantity: item.quantity
    })

    if (!result.success) {
      alert(`Error processing sale: ${result.error}`)
      return
    }
  }

  // Update user credits locally
  selectedUser.value.credits -= totalCost.value

  // Clear cart and refresh data
  clearCart()
  await Promise.all([
    drinksStore.fetchDrinks(),
    salesStore.fetchTransactionHistory({ limit: 10 })
  ])

  alert('Sale processed successfully!')
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
  font-size: 2.5rem;
  color: var(--color-teal);
  margin-bottom: 0.5rem;
}

.sales-container {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.sales-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.sales-section h2 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.customer-search input,
.drinks-search input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.user-list {
  max-height: 300px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e1e1e1;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.user-item:hover {
  background: #f8f9fa;
}

.user-item.selected {
  background: var(--color-teal);
  color: var(--color-white);
  border-color: var(--color-teal);
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
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
}

.credits {
  color: var(--color-teal);
  font-weight: bold;
}

.drinks-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.drink-card {
  border: 1px solid #e1e1e1;
  border-radius: 6px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.drink-card:hover {
  background: #f8f9fa;
  border-color: var(--color-teal);
}

.drink-info h4 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
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
  padding: 1rem;
  border: 1px solid #e1e1e1;
  border-radius: 6px;
  margin-bottom: 0.5rem;
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
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.recent-sales h2 {
  color: #2c3e50;
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
