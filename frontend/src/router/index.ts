import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.ts";

import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import AdminDashboardView from "../views/AdminDashboardView.vue";
import UsersView from "../views/UsersView.vue";
import DrinksView from "../views/DrinksView.vue";
import SalesView from "../views/SalesView.vue";
import TransactionHistoryView from "../views/TransactionHistoryView.vue";
import LeaderboardView from "../views/LeaderboardView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
      meta: { requiresAuth: true, requiresAdminOrSeller: true },
    },
    {
      path: "/admin",
      name: "admin",
      component: AdminDashboardView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: "/users",
      name: "users",
      component: UsersView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: "/drinks",
      name: "drinks",
      component: DrinksView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: "/sales",
      name: "sales",
      component: SalesView,
      meta: { requiresAuth: true, requiresAdminOrSeller: true },
    },
    {
      path: "/history",
      name: "history",
      component: TransactionHistoryView,
      meta: { requiresAuth: true, requiresAdminOrSeller: true },
    },
    {
      path: "/leaderboard",
      name: "leaderboard",
      component: LeaderboardView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: "/about",
      name: "about",
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import("../views/AboutView.vue"),
    },
  ],
});

// Navigation guard
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  const requiresAuth = to.meta.requiresAuth as boolean | undefined;
  const requiresAdmin = to.meta.requiresAdmin as boolean | undefined;
  const requiresAdminOrSeller = to.meta.requiresAdminOrSeller as boolean | undefined;

  // Always handle authentication before any role-based authorization
  if (requiresAuth && !authStore.isAuthenticated) {
    return next("/login");
  }
  // Handle admin-only routes
  if (requiresAdmin && !authStore.isAdmin) {
    // If not authenticated, redirect to login instead of a protected route
    return next(authStore.isAuthenticated ? "/sales" : "/login");
  }
  // Handle routes accessible to admins or sellers
  if (requiresAdminOrSeller && !authStore.isAdminOrSeller) {
    return next("/login");
  }
  return next();
});

export default router;
