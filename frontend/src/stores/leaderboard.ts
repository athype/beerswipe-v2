import { defineStore } from 'pinia';
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  MonthlyLeaderboardResponse,
  StoreActionResult,
  UserRankResponse,
} from '@beerswipe/types';
import { leaderboardAPI } from '../services/api';

interface LeaderboardState {
  leaderboard: LeaderboardEntry[];
  period: LeaderboardPeriod | null;
  loading: boolean;
  error: string | null;
  userRank: UserRankResponse | null;
}

export const useLeaderboardStore = defineStore('leaderboard', {
  state: (): LeaderboardState => ({
    leaderboard: [],
    period: null,
    loading: false,
    error: null,
    userRank: null,
  }),

  getters: {
    topThree: (state: LeaderboardState): LeaderboardEntry[] => state.leaderboard.slice(0, 3),
    
    hasData: (state: LeaderboardState): boolean => state.leaderboard.length > 0,
    
    currentMonthYear: (): { year: number; month: number } => {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      };
    },
  },

  actions: {
    async fetchLeaderboard(year: number, month: number): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await leaderboardAPI.getMonthly(year, month);

        if (response.data) {
          this.leaderboard = response.data.leaderboard || [];
          this.period = response.data.period || null;
          return { success: true };
        } else {
          this.error = 'Failed to fetch leaderboard';
          return { success: false, error: this.error };
        }
      } catch (error: unknown) {
        console.error('Fetch leaderboard error:', error);
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to fetch leaderboard';
        this.leaderboard = [];
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchUserRank(userId: number, year: number, month: number): Promise<StoreActionResult<UserRankResponse>> {
      try {
        const response = await leaderboardAPI.getUserRank(userId, year, month);

        if (response.data) {
          this.userRank = response.data;
          return { success: true, data: response.data };
        } else {
          return { success: false, error: 'Failed to fetch user rank' };
        }
      } catch (error: unknown) {
        console.error('Fetch user rank error:', error);
        const err = error as { response?: { data?: { error?: string } } };
        return { 
          success: false, 
          error: err.response?.data?.error || 'Failed to fetch user rank',
        };
      }
    },

    async fetchCurrentMonthLeaderboard(): Promise<StoreActionResult> {
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
