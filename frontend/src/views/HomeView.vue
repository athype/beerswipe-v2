<template>
  <div class="home">
    <div class="hero">
      <div class="hero-logo">
        <img src="@/assets/logo2.svg" alt="Beer Machine Logo" class="logo" />
      </div>
      <h1>Beer Machine v3</h1>
      <p>SV ADA Drink Management System</p>
      
      <div v-if="!authStore.isAuthenticated" class="hero-actions">
        <RouterLink to="/login" class="btn primary large">
          Admin Login
        </RouterLink>
      </div>
      
      <div v-else class="hero-actions">
        <RouterLink to="/dashboard" class="btn primary large">
          Go to Dashboard
        </RouterLink>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <h3>User Management</h3>
        <p>Manage members, donators, and admin accounts with ease</p>
      </div>
      
      <div class="feature-card">
        <h3>Credit System</h3>
        <p>Add credits in blocks of 10, track balances and transactions</p>
      </div>
      
      <div class="feature-card">
        <h3>Inventory Management</h3>
        <p>Track drink stock, manage pricing, and organize your inventory</p>
      </div>
      
      <div class="feature-card">
        <h3>Sales Terminal</h3>
        <p>Process sales quickly and efficiently with our intuitive interface</p>
      </div>
      
      <div class="feature-card">
        <h3>Transaction History</h3>
        <p>View detailed transaction logs and generate reports</p>
      </div>
      
      <div class="feature-card">
        <h3>CSV Import</h3>
        <p>Bulk import users from CSV files with validation</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.hero {
  padding: 4rem 2rem;
  background: linear-gradient(135deg, var(--color-teal) 0%, var(--color-green) 100%);
  border-radius: 20px;
  margin-bottom: 4rem;
  color: white;
}

.hero-logo {
  margin-bottom: 2rem;
}

.hero-logo .logo {
  width: 340;
  height: 340;
  object-fit: contain;
  filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3));
}

.hero h1 {
  font-size: 4rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.hero p {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  margin-top: 2rem;
}

.btn {
  display: inline-block;
  padding: 1rem 2rem;
  background: var(--color-teal);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn.primary {
  background: white;
  color: var(--color-teal);
  border-color: white;
}

.btn.primary:hover {
  background: #f8f9fa;
}

.btn.large {
  padding: 1.25rem 2.5rem;
  font-size: 1.1rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.feature-card h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.feature-card p {
  color: #7f8c8d;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 3rem;
  }
  
  .hero p {
    font-size: 1.2rem;
  }
  
  .hero-logo .logo {
    width: 80px;
    height: 80px;
  }
  
  .features {
    grid-template-columns: 1fr;
  }
}
</style>
