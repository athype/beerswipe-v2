<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import BottleMark from './BottleMark.vue'

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
      <RouterLink to="/dashboard" class="mobile-brand">
        <BottleMark />
        Beer Machine
      </RouterLink>
      <button class="hamburger-btn" @click="openMenu" aria-label="Open menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="mobile-overlay">
    <div v-if="isMenuOpen" class="mobile-overlay">
      <div class="mobile-overlay-header">
        <span class="mobile-overlay-brand">
          <BottleMark />
          Beer Machine
        </span>
        <button class="close-btn" @click="closeMenu" aria-label="Close menu">
          <svg class="close-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 3 L13 13 M13 3 L3 13" />
          </svg>
        </button>
      </div>

      <nav class="mobile-overlay-nav">
        <RouterLink v-if="authStore.isAdmin" to="/dashboard" class="mobile-nav-link" @click="handleNavClick">Dashboard</RouterLink>
        <RouterLink to="/sales" class="mobile-nav-link" @click="handleNavClick">Sales</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/users" class="mobile-nav-link" @click="handleNavClick">Users</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/drinks" class="mobile-nav-link" @click="handleNavClick">Drinks</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/api-keys" class="mobile-nav-link" @click="handleNavClick">API Keys</RouterLink>
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
    </Transition>
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
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.hamburger-btn:hover span {
  background: var(--green-9);
}

.hamburger-btn span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--color-white);
  border-radius: 2px;
  transition: background 0.3s ease;
}

/* Fullscreen overlay — the bar's backlight washes up the glass as it opens */
.mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background:
    radial-gradient(120% 55% at 50% -5%, rgba(27, 73, 48, 0.55) 0%, rgba(16, 18, 17, 0) 60%),
    rgba(16, 24, 20, 0.97);
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
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--green-7);
  margin-bottom: var(--spacing-xl);
}

.mobile-overlay-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-white);
}

.close-btn {
  background: none;
  border: 1px solid var(--green-7);
  color: var(--color-white);
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.close-icon {
  width: 16px;
  height: 16px;
  stroke: var(--color-white);
  stroke-width: 1.8;
  stroke-linecap: round;
  fill: none;
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

.mobile-nav-link:hover {
  color: var(--color-white);
  background: var(--green-5);
  border-color: var(--green-7);
}

/* The poured glass stays lit: brighter rim, backlight beneath, light on top */
.mobile-nav-link.router-link-active {
  color: var(--color-white);
  background: var(--green-5);
  border-color: var(--green-8);
  box-shadow: 0 4px 16px -4px rgba(48, 164, 108, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06);
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

/* Overlay transition */
.mobile-overlay-enter-active,
.mobile-overlay-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.mobile-overlay-enter-from,
.mobile-overlay-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.mobile-overlay-enter-to,
.mobile-overlay-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Keyboard focus: the accent-teal ring, visible on the dark glass */
.mobile-brand:focus-visible,
.hamburger-btn:focus-visible,
.close-btn:focus-visible,
.mobile-nav-link:focus-visible,
.mobile-username:focus-visible,
.mobile-overlay-footer .btn:focus-visible {
  outline: 2px solid rgba(5, 94, 104, 0.5);
  outline-offset: 2px;
}
</style>
