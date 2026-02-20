<template>
  <div class="drinks-view">
    <div class="drinks-header">
      <h1>Drinks Management</h1>
      <div class="header-actions">
        <button @click="showExportModal = true" class="btn">
          Export Stock CSV
        </button>
        <button @click="showImportModal = true" class="btn">
          Import Stock CSV
        </button>
        <button @click="showCreateModal = true" class="btn">
          Add New Drink
        </button>
      </div>
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

    <CreateEditDrinkModal
      :show="showCreateModal || showEditModal"
      :is-edit="showEditModal"
      :form="drinkForm"
      @close="closeModals"
      @submit="showEditModal ? updateDrink() : createDrink()"
    />

    <AddStockModal
      :show="showStockModal"
      :drink-name="selectedDrink?.name || ''"
      :current-stock="selectedDrink?.stock || 0"
      :quantity="stockQuantity"
      @update:quantity="stockQuantity = $event"
      @close="closeStockModal"
      @submit="addStock"
    />

    <!-- Stock CSV Import/Export Modals -->
    <StockCsvImportModal
      :show="showImportModal"
      @close="showImportModal = false"
      @import="handleImportCSV"
    />

    <StockCsvExportModal
      :show="showExportModal"
      @close="showExportModal = false"
      @export="handleExportCSV"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useNotifications } from '@/composables/useNotifications.js'
import { useDrinksStore } from '../stores/drinks.js'
import StockCsvImportModal from '../components/StockCsvImportModal.vue'
import StockCsvExportModal from '../components/StockCsvExportModal.vue'
import AddStockModal from '../components/modals/AddStockModal.vue'
import CreateEditDrinkModal from '../components/modals/CreateEditDrinkModal.vue'

const drinksStore = useDrinksStore()
const { showSuccess, showError } = useNotifications()

const searchQuery = ref('')
const filterStatus = ref('')
const filterStock = ref('')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showStockModal = ref(false)
const showImportModal = ref(false)
const showExportModal = ref(false)
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

  if (filterStock.value === 'in-stock') {
    params.inStock = true
  } else if (filterStock.value === 'low-stock') {
  } else if (filterStock.value === 'out-of-stock') {
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
    showSuccess('Drink created successfully!')
  } else {
    showError(result.error)
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
    showSuccess('Drink updated successfully!')
  } else {
    showError(result.error)
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
    showSuccess('Stock added successfully!')
  } else {
    showError(result.error)
  }
}

const toggleDrinkStatus = async (drink) => {
  const result = await drinksStore.updateDrink(drink.id, { isActive: !drink.isActive })
  if (result.success) {
    showSuccess(`Drink ${drink.isActive ? 'deactivated' : 'activated'} successfully!`)
  } else {
    showError(result.error)
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

const handleImportCSV = async (file) => {
  const formData = new FormData()
  formData.append('csvFile', file)

  const result = await drinksStore.importCSV(formData)
  if (result.success) {
    showImportModal.value = false
    showSuccess(`Import completed. ${result.data.imported} items imported, ${result.data.errors} errors.`)
  } else {
    showError(result.error)
  }
}

const handleExportCSV = async (params) => {
  const result = await drinksStore.exportCSV(params)
  if (result.success) {
    showExportModal.value = false
    showSuccess('Stock exported successfully!')
  } else {
    showError(result.error)
  }
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
  font-size: var(--font-size-4xl);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.drinks-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-input,
.filter-select {
  padding: var(--spacing-md);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: rgba(34, 34, 34, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-light-grey);
  transition: all 0.3s ease;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--green-7);
  background: rgba(34, 34, 34, 0.7);
  box-shadow: 0 0 0 3px rgba(5, 94, 104, 0.2);
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
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--green-7);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
  padding: var(--spacing-xl);
  transition: all 0.3s ease;
}

.drink-card:hover {
  border-color: var(--green-7);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45);
}

.drink-card.inactive {
  opacity: 0.5;
  background: var(--glass-bg-light);
}

.drink-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.drink-header h3 {
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
  background: rgba(98, 163, 136, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(98, 163, 136, 0.5);
  color: var(--color-white);
}

.status-badge:not(.active) {
  background: rgba(185, 210, 210, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  color: var(--color-white);
}

.drink-info {
  margin-bottom: 1.5rem;
}

.description {
  color: var(--color-white);
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
  color: var(--color-white);
}

.value {
  color: var(--green-11);
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

.loading,
.no-data {
  grid-column: 1 / -1;
  text-align: center;
  color: #7f8c8d;
  padding: 3rem;
}
</style>
