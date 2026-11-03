<script setup lang="ts">
import { useAuthStore } from '../stores/auth.js'
import DesktopNavbar from './Navigation/DesktopNavbar.vue'
import MobileNavbar from './Navigation/MobileNavbar.vue'

const authStore = useAuthStore()

const emit = defineEmits<{ logout: [] }>()

const handleLogout = (): void => {
  emit('logout')
}
</script>

<template>
  <template v-if="authStore.isAuthenticated">
    <div class="nav-desktop">
      <DesktopNavbar @logout="handleLogout" />
    </div>
    <div class="nav-mobile">
      <MobileNavbar @logout="handleLogout" />
    </div>
  </template>
</template>

<style scoped>
.nav-mobile {
  display: none;
}

@media (max-width: 768px) {
  .nav-desktop {
    display: none;
  }

  .nav-mobile {
    display: block;
  }
}
</style>
