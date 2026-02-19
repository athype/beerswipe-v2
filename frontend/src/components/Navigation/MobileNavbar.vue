<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'

const authStore = useAuthStore()

const emit = defineEmits(['logout'])

const isMenuOpen = ref(false)

const openMenu = () => {
  isMenuOpen.value = true
  document.body.style.overflow = 'hidden'
}

const closeMenu = () => {
  isMenuOpen.value = false
  document.body.style.overflow = ''
}

const handleNavClick = () => {
  closeMenu()
}

const handleLogout = () => {
  closeMenu()
  emit('logout')
}
</script>

<template>
  <header class="mobile-header">
    <div class="mobile-topbar">
      <RouterLink to="/dashboard" class="mobile-brand">Beer Machine</RouterLink>
      <button class="hamburger-btn" @click="openMenu" aria-label="Open menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>

  <Teleport to="body">
    <div v-if="isMenuOpen" class="mobile-overlay">
      <div class="mobile-overlay-header">
        <span class="mobile-overlay-brand">Beer Machine</span>
        <button class="close-btn" @click="closeMenu" aria-label="Close menu">✕</button>
      </div>

      <nav class="mobile-overlay-nav">
        <RouterLink v-if="authStore.isAdmin" to="/dashboard" class="mobile-nav-link" @click="handleNavClick">Dashboard</RouterLink>
        <RouterLink to="/sales" class="mobile-nav-link" @click="handleNavClick">Sales</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/users" class="mobile-nav-link" @click="handleNavClick">Users</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/drinks" class="mobile-nav-link" @click="handleNavClick">Drinks</RouterLink>
        <RouterLink to="/history" class="mobile-nav-link" @click="handleNavClick">History</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/leaderboard" class="mobile-nav-link" @click="handleNavClick">Leaderboard</RouterLink>
      </nav>

      <div class="mobile-overlay-footer">
        <RouterLink v-if="authStore.isAdmin" to="/admin" class="mobile-username" @click="handleNavClick">
          {{ authStore.user?.username }}
        </RouterLink>
        <span v-else class="mobile-username">{{ authStore.user?.username }}</span>
        <button @click="handleLogout" class="btn btn-sm">Logout</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mobile-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.mobile-topbar {
  background: rgba(52, 52, 52, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--green-7);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  color: var(--color-white);
  padding: var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mobile-brand {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-white);
  text-decoration: none;
  transition: color 0.3s ease;
}

.mobile-brand:hover {
  color: var(--green-9);
}

.hamburger-btn {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: background 0.3s ease;
}

.hamburger-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.hamburger-btn span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--color-white);
  border-radius: 2px;
}

/* Fullscreen overlay */
.mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(16, 24, 20, 0.97);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
}

.mobile-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--green-7);
  margin-bottom: var(--spacing-xl);
}

.mobile-overlay-brand {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-white);
}

.close-btn {
  background: none;
  border: 1px solid var(--green-7);
  color: var(--color-white);
  font-size: 1.25rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.close-btn:hover {
  background: var(--green-5);
}

.mobile-overlay-nav {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
}

.mobile-nav-link {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: 600;
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.mobile-nav-link:hover,
.mobile-nav-link.router-link-active {
  color: var(--color-white);
  background: var(--green-5);
  border-color: var(--green-7);
}

.mobile-overlay-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  border-top: 1px solid var(--green-7);
  margin-top: var(--spacing-xl);
}

.mobile-username {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  font-size: var(--font-size-sm);
  text-decoration: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  transition: background 0.3s ease;
}

a.mobile-username:hover {
  background: var(--green-5);
}
</style>
