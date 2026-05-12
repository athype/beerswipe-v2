import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router/index.ts";
import { useAuthStore } from "./stores/auth.ts";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount("#app");
// Initialize auth from HTTP-only cookies via /auth/me after mounting (non-blocking)
const authStore = useAuthStore();
void authStore.initializeAuth();
