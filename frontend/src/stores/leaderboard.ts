import { defineStore } from "pinia";
import { leaderboardAPI } from "../services/api.ts";

export interface LeaderboardEntry {
  userId: number;
  name: string;
  totalSpent: number;
  rank: number;
}

export interface LeaderboardPeriod {
  year: number;
  month: number;
}

interface LeaderboardState {
  leaderboard: LeaderboardEntry[];
  period: LeaderboardPeriod | null;
  loading: boolean;
  error: string | null;
  userRank: unknown;
}

interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export const useLeaderboardStore = defineStore("leaderboard", {
  state: (): LeaderboardState => ({
    leaderboard: [],
    period: null,
    loading: false,
    error: null,
    userRank: null,
  }),

  getters: {
    topThree: (state) => state.leaderboard.slice(0, 3),

    hasData: (state) => state.leaderboard.length > 0,

    currentMonthYear: (): { year: number; month: number } => {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      };
    },
  },

  actions: {
    async fetchLeaderboard(year: number, month: number): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await leaderboardAPI.getMonthly(year, month);

        if (response.data) {
          const data = response.data as {
            leaderboard?: LeaderboardEntry[];
            period?: LeaderboardPeriod;
          };
          this.leaderboard = data.leaderboard ?? [];
          this.period = data.period ?? null;
          return { success: true };
        } else {
          this.error = "Failed to fetch leaderboard";
          return { success: false, error: this.error };
        }
      } catch (error) {
        console.error("Fetch leaderboard error:", error);
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to fetch leaderboard";
        this.leaderboard = [];
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchUserRank(userId: number, year: number, month: number): Promise<ActionResult> {
      try {
        const response = await leaderboardAPI.getUserRank(userId, year, month);

        if (response.data) {
          this.userRank = response.data;
          return { success: true, data: response.data };
        } else {
          return { success: false, error: "Failed to fetch user rank" };
        }
      } catch (error) {
        console.error("Fetch user rank error:", error);
        const err = error as { response?: { data?: { error?: string } } };
        return {
          success: false,
          error: err.response?.data?.error ?? "Failed to fetch user rank",
        };
      }
    },

    async fetchCurrentMonthLeaderboard(): Promise<ActionResult> {
      const { year, month } = this.currentMonthYear;
      return await this.fetchLeaderboard(year, month);
    },

    clearLeaderboard(): void {
      this.leaderboard = [];
      this.period = null;
      this.error = null;
      this.userRank = null;
    },
  },
});
