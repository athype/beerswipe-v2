import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import AdminDashboardView from '../views/AdminDashboardView.vue'
import UsersView from '../views/UsersView.vue'
import DrinksView from '../views/DrinksView.vue'
import SalesView from '../views/SalesView.vue'
import TransactionHistoryView from '../views/TransactionHistoryView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminDashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: UsersView,
      meta: { requiresAuth: true },
    },
    {
      path: '/drinks',
      name: 'drinks',
      component: DrinksView,
      meta: { requiresAuth: true },
    },
    {
      path: '/sales',
      name: 'sales',
      component: SalesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/history',
      name: 'history',
      component: TransactionHistoryView,
      meta: { requiresAuth: true },
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: LeaderboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router
