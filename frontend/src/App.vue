<script setup>
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'
import NotificationContainer from './components/NotificationContainer.vue'

const authStore = useAuthStore()
const router = useRouter()

onMounted(() => {
  authStore.initializeAuth()
})

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div id="app">
    <header v-if="authStore.isAuthenticated">
      <nav class="navbar">
        <div class="container">
          <div class="navbar-content">
            <RouterLink to="/dashboard" class="navbar-brand">
              Beer Machine
            </RouterLink>
            
            <div class="navbar-nav">
              <RouterLink to="/dashboard" class="navbar-link">Dashboard</RouterLink>
              <RouterLink to="/sales" class="navbar-link">Sales</RouterLink>
              <RouterLink to="/users" class="navbar-link">Users</RouterLink>
              <RouterLink to="/drinks" class="navbar-link">Drinks</RouterLink>
              <RouterLink to="/history" class="navbar-link">History</RouterLink>
              
              <div class="navbar-user">
                <span class="text-sm">{{ authStore.user?.username }}</span>
                <button @click="logout" class="btn btn-danger btn-sm">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main>
      <div class="container">
        <RouterView />
      </div>
    </main>
    
    <!-- Global notification system -->
    <NotificationContainer />
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
  padding: var(--spacing-xl) 0;
}

/* Make navbar links work with router-link-active */
.navbar-link.router-link-active {
  color: var(--color-white);
  background: var(--color-teal);
}
</style>
