import type { ISODateString } from "./common.js";
import type { UserType } from "./domain.js";

export interface MonthlyLeaderboardQuery {
  year: number;
  month: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  userType: UserType;
  transactionCount: number;
  totalDrinks: number;
  totalSpent: number;
}

export interface LeaderboardPeriod {
  year: number;
  month: number;
  monthName: string;
  startDate: ISODateString;
  endDate: ISODateString;
}

export interface MonthlyLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  period: LeaderboardPeriod;
}

export interface UserRankQuery {
  year: number;
  month: number;
}

export interface UserRankResponse {
  rank: number | null;
  totalDrinks: number;
  totalUsers: number;
}
