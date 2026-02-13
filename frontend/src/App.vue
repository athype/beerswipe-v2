<script setup>
import { onMounted, computed } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'
import NotificationContainer from './components/NotificationContainer.vue'
import NavBar from './components/NavBar.vue'
import Dither from './vue-bits-backgrounds/Dither/Dither.vue'

const authStore = useAuthStore()
const router = useRouter()

const isChrome = computed(() => {
  const userAgent = navigator.userAgent.toLowerCase()
  return userAgent.includes('chrome') && !userAgent.includes('edg')
})

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
    <!-- <Dither 
      v-if="!isChrome"
      class="bg"
      :wave-speed="0.03"
      :wave-frequency="3"
      :wave-amplitude="0.3"
      :wave-color="[0.1, 0.7, 0.7]"
      :color-num="4"
      :pixel-size="2"
      :disable-animation="false"
      :enable-mouse-interaction="false"
      :mouse-radius="0.3"
    /> -->
    
    <!-- Navigation -->
    <NavBar @logout="logout" />

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
  position: relative;
}

main {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: var(--spacing-xl) 0;
  pointer-events: none;
}

main > * {
  pointer-events: auto;
}

.bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: auto;
}
</style>
