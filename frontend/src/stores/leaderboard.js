import { defineStore } from 'pinia'
import { leaderboardAPI } from '../services/api.js'

export const useLeaderboardStore = defineStore('leaderboard', {
  state: () => ({
    leaderboard: [],
    period: null,
    loading: false,
    error: null,
    userRank: null
  }),

  getters: {
    topThree: (state) => state.leaderboard.slice(0, 3),
    
    hasData: (state) => state.leaderboard.length > 0,
    
    currentMonthYear: () => {
      const now = new Date()
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1
      }
    }
  },

  actions: {
    async fetchLeaderboard(year, month) {
      this.loading = true
      this.error = null

      try {
        const response = await leaderboardAPI.getMonthly(year, month)

        if (response.data) {
          this.leaderboard = response.data.leaderboard || []
          this.period = response.data.period || null
          return { success: true }
        } else {
          this.error = 'Failed to fetch leaderboard'
          return { success: false, error: this.error }
        }
      } catch (error) {
        console.error('Fetch leaderboard error:', error)
        this.error = error.response?.data?.error || 'Failed to fetch leaderboard'
        this.leaderboard = []
        return { success: false, error: this.error }
      } finally {
        this.loading = false
      }
    },

    async fetchUserRank(userId, year, month) {
      try {
        const response = await leaderboardAPI.getUserRank(userId, year, month)

        if (response.data) {
          this.userRank = response.data
          return { success: true, data: response.data }
        } else {
          return { success: false, error: 'Failed to fetch user rank' }
        }
      } catch (error) {
        console.error('Fetch user rank error:', error)
        return { 
          success: false, 
          error: error.response?.data?.error || 'Failed to fetch user rank' 
        }
      }
    },

    async fetchCurrentMonthLeaderboard() {
      const { year, month } = this.currentMonthYear
      return await this.fetchLeaderboard(year, month)
    },

    clearLeaderboard() {
      this.leaderboard = []
      this.period = null
      this.error = null
      this.userRank = null
    }
  }
})
