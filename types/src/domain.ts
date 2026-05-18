import type { ISODateString } from "./common.js";

export type UserType = "admin" | "seller" | "member" | "non-member";

export type AdminUserType = "admin" | "seller";

export type MemberUserType = "member" | "non-member";

export type TransactionType = "sale" | "credit_addition";

export interface AuthUser {
  id: number;
  username: string;
  userType: UserType;
  credits: number;
}

export interface User {
  id: number;
  username: string;
  credits: number;
  dateOfBirth: ISODateString | null;
  userType: UserType;
  isActive: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface AdminAccount {
  id: number;
  username: string;
  userType: AdminUserType;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Drink {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  category: string;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}
