<script setup>
import { onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'
import NotificationContainer from './components/NotificationContainer.vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'

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
    
    <!-- Background orbs  -->
    <Teleport to="body">
      <div class="orb orb-1" aria-hidden="true"></div>
      <div class="orb orb-2" aria-hidden="true"></div>
      <div class="orb orb-3" aria-hidden="true"></div>
    </Teleport>

    <!-- Navigation -->
    <NavBar @logout="logout" />

    <main>
      <div class="container">
        <RouterView />
      </div>
    </main>
    
    <!-- Global notification system -->
    <NotificationContainer />
    <Footer />
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

#app::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  background-color: var(--gray-1);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px 200px;
  pointer-events: none;
}

main {
  position: relative;
  z-index: 1;
  flex: 1;
  pointer-events: none;
}

main > * {
  pointer-events: auto;
}

/* Decorative orbs */
.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.55;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle at center, var(--green-8), var(--green-5) 50%, transparent 75%);
  top: -120px;
  left: -150px;
  animation: drift 18s ease-in-out infinite alternate;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle at center, var(--green-7), var(--green-4) 50%, transparent 75%);
  bottom: 5%;
  right: -100px;
  animation: drift 22s ease-in-out infinite alternate-reverse;
}

.orb-3 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle at center, var(--green-3), var(--green-5) 50%, transparent 75%);
  top: 45%;
  left: 55%;
  animation: drift 26s ease-in-out infinite alternate;
}

@keyframes drift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(40px, 30px) scale(1.06); }
}
</style>
