<template>
  <div class="drinks-view">
    <div class="drinks-header">
      <h1>Drinks Management</h1>
      <button @click="showCreateModal = true" class="btn primary">
        Add New Drink
      </button>
    </div>

    <div class="drinks-filters">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search drinks..."
        @input="searchDrinks"
        class="search-input"
      />
      <select v-model="filterStatus" @change="searchDrinks" class="filter-select">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select v-model="filterStock" @change="searchDrinks" class="filter-select">
        <option value="">All Stock</option>
        <option value="in-stock">In Stock</option>
        <option value="low-stock">Low Stock (≤5)</option>
        <option value="out-of-stock">Out of Stock</option>
      </select>
    </div>

    <div class="drinks-grid">
      <div v-if="drinksStore.loading" class="loading">Loading drinks...</div>
      <div v-else-if="drinksStore.drinks.length === 0" class="no-data">
        No drinks found
      </div>
      <div
        v-else
        v-for="drink in drinksStore.drinks"
        :key="drink.id"
        class="drink-card"
        :class="{ inactive: !drink.isActive }"
      >
        <div class="drink-header">
          <h3>{{ drink.name }}</h3>
          <div class="drink-status">
            <span class="status-badge" :class="{ active: drink.isActive }">
              {{ drink.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>

        <div class="drink-info">
          <p class="description">{{ drink.description || 'No description' }}</p>
          <div class="drink-details">
            <div class="detail">
              <span class="label">Price:</span>
              <span class="value">{{ drink.price }} credits</span>
            </div>
            <div class="detail">
              <span class="label">Stock:</span>
              <span class="value" :class="{ 'low-stock': drink.stock <= 5, 'out-of-stock': drink.stock === 0 }">
                {{ drink.stock }}
              </span>
            </div>
            <div class="detail">
              <span class="label">Category:</span>
              <span class="value">{{ drink.category }}</span>
            </div>
          </div>
        </div>

        <div class="drink-actions">
          <button @click="openAddStockModal(drink)" class="btn small">
            Add Stock
          </button>
          <button @click="openEditModal(drink)" class="btn small">
            Edit
          </button>
          <button 
            @click="toggleDrinkStatus(drink)" 
            class="btn small"
            :class="drink.isActive ? 'danger' : 'success'"
          >
            {{ drink.isActive ? 'Deactivate' : 'Activate' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="drinksStore.pagination.pages > 1" class="pagination">
      <button 
        @click="changePage(drinksStore.pagination.page - 1)"
        :disabled="drinksStore.pagination.page === 1"
        class="btn small"
      >
        Previous
      </button>
      <span>
        Page {{ drinksStore.pagination.page }} of {{ drinksStore.pagination.pages }}
      </span>
      <button 
        @click="changePage(drinksStore.pagination.page + 1)"
        :disabled="drinksStore.pagination.page === drinksStore.pagination.pages"
        class="btn small"
      >
        Next
      </button>
    </div>

    <!-- Create/Edit Drink Modal -->
    <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click="closeModals">
      <div class="modal" @click.stop>
        <h2>{{ showEditModal ? 'Edit Drink' : 'Add New Drink' }}</h2>
        <form @submit.prevent="showEditModal ? updateDrink() : createDrink()">
          <div class="form-group">
            <label for="name">Name:</label>
            <input
              id="name"
              v-model="drinkForm.name"
              type="text"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="description">Description:</label>
            <textarea
              id="description"
              v-model="drinkForm.description"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="price">Price (credits):</label>
            <input
              id="price"
              v-model.number="drinkForm.price"
              type="number"
              min="1"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="stock">Initial Stock:</label>
            <input
              id="stock"
              v-model.number="drinkForm.stock"
              type="number"
              min="0"
            />
          </div>
          
          <div class="form-group">
            <label for="category">Category:</label>
            <input
              id="category"
              v-model="drinkForm.category"
              type="text"
              placeholder="beverage, snack, etc."
            />
          </div>
          
          <div v-if="showEditModal" class="form-group">
            <label class="checkbox-label">
              <input
                v-model="drinkForm.isActive"
                type="checkbox"
              />
              Active
            </label>
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeModals" class="btn">Cancel</button>
            <button type="submit" class="btn primary">
              {{ showEditModal ? 'Update Drink' : 'Create Drink' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Stock Modal -->
    <div v-if="showStockModal" class="modal-overlay" @click="closeStockModal">
      <div class="modal" @click.stop>
        <h2>Add Stock to {{ selectedDrink?.name }}</h2>
        <form @submit.prevent="addStock">
          <div class="form-group">
            <label for="stockQuantity">Quantity to Add:</label>
            <input
              id="stockQuantity"
              v-model.number="stockQuantity"
              type="number"
              min="1"
              required
            />
          </div>
          
          <div class="current-stock">
            Current Stock: {{ selectedDrink?.stock }}
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeStockModal" class="btn">Cancel</button>
            <button type="submit" class="btn primary">Add Stock</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useDrinksStore } from '../stores/drinks.js'

const drinksStore = useDrinksStore()

const searchQuery = ref('')
const filterStatus = ref('')
const filterStock = ref('')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showStockModal = ref(false)
const selectedDrink = ref(null)
const stockQuantity = ref(1)

const drinkForm = reactive({
  name: '',
  description: '',
  price: 1,
  stock: 0,
  category: 'beverage',
  isActive: true
})

const searchDrinks = async () => {
  const params = {}
  if (searchQuery.value) params.search = searchQuery.value
  
  // Handle stock filtering
  if (filterStock.value === 'in-stock') {
    params.inStock = true
  } else if (filterStock.value === 'low-stock') {
    // This would need backend support for low stock filtering
  } else if (filterStock.value === 'out-of-stock') {
    // This would need backend support for out of stock filtering
  }
  
  await drinksStore.fetchDrinks(params)
}

const changePage = async (page) => {
  const params = { page }
  if (searchQuery.value) params.search = searchQuery.value
  if (filterStock.value === 'in-stock') params.inStock = true
  
  await drinksStore.fetchDrinks(params)
}

const createDrink = async () => {
  const result = await drinksStore.createDrink(drinkForm)
  if (result.success) {
    closeModals()
    alert('Drink created successfully!')
  } else {
    alert(result.error)
  }
}

const openEditModal = (drink) => {
  selectedDrink.value = drink
  Object.assign(drinkForm, {
    name: drink.name,
    description: drink.description || '',
    price: drink.price,
    stock: drink.stock,
    category: drink.category,
    isActive: drink.isActive
  })
  showEditModal.value = true
}

const updateDrink = async () => {
  const result = await drinksStore.updateDrink(selectedDrink.value.id, drinkForm)
  if (result.success) {
    closeModals()
    alert('Drink updated successfully!')
  } else {
    alert(result.error)
  }
}

const openAddStockModal = (drink) => {
  selectedDrink.value = drink
  stockQuantity.value = 1
  showStockModal.value = true
}

const addStock = async () => {
  const result = await drinksStore.addStock(selectedDrink.value.id, stockQuantity.value)
  if (result.success) {
    closeStockModal()
    alert('Stock added successfully!')
  } else {
    alert(result.error)
  }
}

const toggleDrinkStatus = async (drink) => {
  const result = await drinksStore.updateDrink(drink.id, { isActive: !drink.isActive })
  if (result.success) {
    alert(`Drink ${drink.isActive ? 'deactivated' : 'activated'} successfully!`)
  } else {
    alert(result.error)
  }
}

const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  selectedDrink.value = null
  Object.assign(drinkForm, {
    name: '',
    description: '',
    price: 1,
    stock: 0,
    category: 'beverage',
    isActive: true
  })
}

const closeStockModal = () => {
  showStockModal.value = false
  selectedDrink.value = null
  stockQuantity.value = 1
}

onMounted(() => {
  drinksStore.fetchDrinks()
})
</script>

<style scoped>
.drinks-view {
  max-width: 1400px;
  margin: 0 auto;
}

.drinks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.drinks-header h1 {
  font-size: 2.5rem;
  color: var(--color-teal);
}

.drinks-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-input,
.filter-select {
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
}

.search-input {
  flex: 1;
  max-width: 400px;
}

.drinks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.drink-card {
  background: var(--color-black);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.drink-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.drink-card.inactive {
  opacity: 0.6;
  background: #f8f9fa;
}

.drink-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.drink-header h3 {
  color: #2c3e50;
  margin: 0;
  font-size: 1.3rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.active {
  background: var(--color-green);
  color: var(--color-white);
}

.status-badge:not(.active) {
  background: var(--color-grey);
  color: var(--color-white);
}

.drink-info {
  margin-bottom: 1.5rem;
}

.description {
  color: var(--color-grey);
  margin-bottom: 1rem;
  font-style: italic;
}

.drink-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail {
  display: flex;
  justify-content: space-between;
}

.label {
  font-weight: 500;
  color: #2c3e50;
}

.value {
  color: var(--color-teal);
  font-weight: 500;
}

.value.low-stock {
  color: #f39c12;
}

.value.out-of-stock {
  color: #e74c3c;
}

.drink-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  background: var(--color-teal);
  color: var(--color-white);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
  flex: 1;
  min-width: 100px;
}

.btn:hover {
  background: var(--color-teal-dark);
}

.btn.primary {
  background: var(--color-teal);
}

.btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}

.btn.danger {
  background: #e74c3c;
}

.btn.danger:hover {
  background: #c0392b;
}

.btn.success {
  background: var(--color-green);
}

.btn.success:hover {
  background: var(--color-teal-dark);
}

.btn:disabled {
  background: var(--color-grey);
  cursor: not-allowed;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

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
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h2 {
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: auto !important;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.current-stock {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.loading,
.no-data {
  grid-column: 1 / -1;
  text-align: center;
  color: #7f8c8d;
  padding: 3rem;
}
</style>
