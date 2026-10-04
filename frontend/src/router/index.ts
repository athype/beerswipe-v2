import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import AdminDashboardView from '../views/AdminDashboardView.vue'
import UsersView from '../views/UsersView.vue'
import DrinksView from '../views/DrinksView.vue'
import ApiKeysView from '../views/ApiKeysView.vue'
import SalesView from '../views/SalesView.vue'
import TransactionHistoryView from '../views/TransactionHistoryView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'

// Extend vue-router's RouteMeta
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    requiresAdminOrSeller?: boolean
  }
}

const routes: RouteRecordRaw[] = [
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
    meta: { requiresAuth: true, requiresAdminOrSeller: true },
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminDashboardView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/users',
    name: 'users',
    component: UsersView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/drinks',
    name: 'drinks',
    component: DrinksView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/api-keys',
    name: 'api-keys',
    component: ApiKeysView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/sales',
    name: 'sales',
    component: SalesView,
    meta: { requiresAuth: true, requiresAdminOrSeller: true },
  },
  {
    path: '/history',
    name: 'history',
    component: TransactionHistoryView,
    meta: { requiresAuth: true, requiresAdminOrSeller: true },
  },
  {
    path: '/leaderboard',
    name: 'leaderboard',
    component: LeaderboardView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  
  const requiresAuth = to.meta.requiresAuth
  const requiresAdmin = to.meta.requiresAdmin
  const requiresAdminOrSeller = to.meta.requiresAdminOrSeller

  // Ensure auth state is initialized before access-control decisions on a hard refresh/deep link
  if (requiresAuth && !authStore.isAuthenticated) {
    await authStore.initializeAuth()
  }

  if (requiresAuth && !authStore.isAuthenticated) {
    return next('/login')
  }
  if (requiresAdmin && !authStore.isAdmin) {
    return next(authStore.isAuthenticated ? '/sales' : '/login')
  }
  if (requiresAdminOrSeller && !authStore.isAdminOrSeller) {
    return next('/login')
  }
  return next()
})

export default router
