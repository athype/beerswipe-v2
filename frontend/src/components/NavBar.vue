<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()

const emit = defineEmits(['logout'])

const handleLogout = () => {
  emit('logout')
}
</script>

<template>
  <header v-if="authStore.isAuthenticated">
    <nav class="navbar">
      <div class="container">
        <div class="navbar-content">
          <RouterLink to="/dashboard" class="navbar-brand">
            Beer Machine
          </RouterLink>
          
          <div class="navbar-nav">
            <RouterLink v-if="authStore.isAdmin" to="/dashboard" class="navbar-link">Dashboard</RouterLink>
            <RouterLink to="/sales" class="navbar-link">Sales</RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/users" class="navbar-link">Users</RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/drinks" class="navbar-link">Drinks</RouterLink>
            <RouterLink to="/history" class="navbar-link">History</RouterLink>
            <RouterLink v-if="authStore.isAdmin" to="/leaderboard" class="navbar-link">Leaderboard</RouterLink>
            
            <div class="navbar-user">
              <RouterLink v-if="authStore.isAdmin" to="/admin" class="username-link">
                {{ authStore.user?.username }}
              </RouterLink>
              <span v-else class="username-display">
                {{ authStore.user?.username }}
              </span>
              <button @click="handleLogout" class="btn btn-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
header {
  position: relative;
  z-index: 100;
}

.navbar {
  background: rgba(52, 52, 52, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--green-7);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  color: var(--color-white);
  padding: var(--spacing-md) 0;
  position: sticky;
  top: 0;
  z-index: 5;
}

.navbar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-brand {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-white);
  text-decoration: none;
  transition: all 0.3s ease;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
}

.navbar-brand:hover {
  color: var(--green-9);
}

.navbar-nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  list-style: none;
}

.navbar-link {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
  font-weight: 500;
  position: relative;
}

.navbar-link::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--green-5);
  transition: width 0.3s ease;
}

.navbar-link:hover {
  color: var(--color-white);
  background: rgba(255, 255, 255, 0.1);
}

.navbar-link:hover::before {
  width: 80%;
}

.navbar-link.router-link-active {
  color: var(--color-white);
  background: var(--green-5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--green-7);
}

.navbar-link.router-link-active::before {
  width: 80%;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  margin-left: var(--spacing-xl);
  padding-left: var(--spacing-xl);
  border-left: 1px solid var(--green-7);
  transition: all 0.3s ease;
}

.navbar-user .text-sm {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.username-link {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  text-decoration: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
  font-size: var(--font-size-sm);
}

.username-link:hover {
  color: var(--color-white);
  background: var(--green-5);
  transform: translateY(-1px);
}

.username-display {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
}

/* Glass effect on hover for user section */
.navbar-user:hover {
  background: var(--gray-3);
  border-radius: var(--radius-md);
  margin-left: calc(var(--spacing-xl) - var(--spacing-sm));
  padding-left: calc(var(--spacing-xl) + var(--spacing-sm));
  padding-right: var(--spacing-sm);
  margin-right: calc(-1 * var(--spacing-sm));
  transition: all 0.3s ease;
}

.navbar-user:not(:hover) {
  transition: all 0.3s ease;
}

/* Responsive styles */
@media (max-width: 768px) {
  .navbar-content {
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .navbar-nav {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .navbar-user {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    border-top: 1px solid var(--green-7);
    padding-top: var(--spacing-md);
  }
  
  .navbar-user:hover {
    margin-left: 0;
    padding-left: var(--spacing-sm);
    margin-right: 0;
  }
}
</style>
