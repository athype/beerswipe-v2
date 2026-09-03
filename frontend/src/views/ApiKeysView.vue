<template>
  <div class="api-keys-view">
    <div class="api-keys-header">
      <h1>API Keys</h1>
      <div class="header-actions">
        <button @click="openCreateModal" class="btn">
          Create API Key
        </button>
      </div>
    </div>

    <p class="page-hint">
      Long-lived credentials for programmatic clients (kiosk, third-party
      integrations). Each key acts as the admin who created it, limited to its
      scope. The plaintext key is shown once, at creation.
    </p>

    <div class="api-keys-table">
      <div v-if="apiKeysStore.loading" class="loading">Loading API keys...</div>
      <div v-else-if="apiKeysStore.apiKeys.length === 0" class="no-data">
        No API keys yet. Create one for each kiosk or integration.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Scope</th>
            <th>Created by</th>
            <th>Created</th>
            <th>Last used</th>
            <th>Expires</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in apiKeysStore.apiKeys" :key="key.id" :class="{ muted: isInactive(key) }">
            <td>{{ key.name }}</td>
            <td><code class="key-mask">{{ key.prefix }}****</code></td>
            <td>
              <span class="scope" :class="key.scope">
                {{ key.scope }}
              </span>
            </td>
            <td>{{ key.creator.username }}</td>
            <td>{{ formatDate(key.createdAt) }}</td>
            <td>{{ formatDate(key.lastUsedAt) }}</td>
            <td>{{ formatDate(key.expiresAt) }}</td>
            <td>
              <span class="status" :class="statusClass(key)">
                {{ statusText(key) }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button
                  v-if="!key.isRevoked"
                  @click="confirmRevoke(key)"
                  class="btn small"
                  title="Revoke key"
                >
                  Revoke
                </button>
                <button
                  v-if="key.isRevoked"
                  @click="confirmDelete(key)"
                  class="btn small danger"
                  title="Delete key"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CreateApiKeyModal
      :show="showCreateModal"
      :created="createdKey"
      @close="closeCreateModal"
      @submit="handleCreateApiKey"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useApiKeysStore } from '../stores/apiKeys'
import { useNotifications } from '@/composables/useNotifications'
import CreateApiKeyModal from '../components/CreateApiKeyModal.vue'

const apiKeysStore = useApiKeysStore()
const { showSuccess, showError } = useNotifications()

const showCreateModal = ref(false)
const createdKey = ref(null)

const isExpired = (key) => key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()
const isInactive = (key) => key.isRevoked || isExpired(key)

const statusText = (key) => {
  if (key.isRevoked) return 'Revoked'
  if (isExpired(key)) return 'Expired'
  return 'Active'
}

const statusClass = (key) => {
  if (key.isRevoked) return 'revoked'
  if (isExpired(key)) return 'expired'
  return 'active'
}

const formatDate = (value) => {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

const openCreateModal = () => {
  createdKey.value = null
  showCreateModal.value = true
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createdKey.value = null
}

const handleCreateApiKey = async (payload) => {
  const result = await apiKeysStore.createApiKey(payload)
  if (result.success) {
    createdKey.value = result.data
    // Modal stays open on the one-time reveal phase; the store already refreshed the list.
  } else {
    showError(result.error)
    closeCreateModal()
  }
}

const confirmRevoke = async (key) => {
  if (!window.confirm(`Revoke API key "${key.name}"? Clients using it will immediately lose access.`)) return
  const result = await apiKeysStore.revokeApiKey(key.id)
  if (result.success) {
    showSuccess(`API key "${key.name}" revoked`)
  } else {
    showError(result.error)
  }
}

const confirmDelete = async (key) => {
  if (!window.confirm(`Permanently delete API key "${key.name}"? This cannot be undone.`)) return
  const result = await apiKeysStore.removeApiKey(key.id)
  if (result.success) {
    showSuccess(`API key "${key.name}" deleted`)
  } else {
    showError(result.error)
  }
}

onMounted(() => {
  apiKeysStore.listApiKeys()
})
</script>

<style scoped>
.api-keys-view {
  max-width: 1400px;
  margin: 0 auto;
}

.api-keys-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.api-keys-header h1 {
  font-size: var(--font-size-4xl);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.page-hint {
  color: var(--color-medium-grey);
  max-width: 70ch;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .api-keys-header {
    flex-direction: column;
    align-items: stretch;
  }

  .api-keys-header h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .header-actions {
    justify-content: flex-start;
  }
}

.api-keys-table {
  background: var(--color-black);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e1e1e1;
}

th {
  background: var(--green-3);
  font-weight: 600;
  color: var(--color-white);
}

tr.muted {
  opacity: 0.6;
}

.key-mask {
  font-family: monospace;
  color: var(--color-light-grey);
}

.scope {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.scope.admin {
  background: var(--red-9);
  color: white;
}

.scope.seller {
  background: var(--blue-9);
  color: white;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status.active {
  background: var(--color-green);
  color: var(--color-white);
}

.status.revoked {
  background: var(--color-grey);
  color: var(--color-white);
}

.status.expired {
  background: var(--orange-9);
  color: white;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  background: var(--green-3);
  color: var(--color-white);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn:hover {
  background: var(--green-5);
}

.btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}

.btn.danger {
  background: var(--red-8);
}

.btn.danger:hover {
  background: var(--red-9);
}

.loading,
.no-data {
  text-align: center;
  color: var(--color-medium-grey);
  padding: 3rem;
}
</style>
