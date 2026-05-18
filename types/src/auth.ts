import type { AuthUser, UserType } from "./domain.js";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
}

export interface CurrentUserResponse {
  user: AuthUser;
}

export interface LogoutResponse {
  message: string;
}

export interface CreateBootstrapAdminRequest {
  username: string;
  password: string;
}

export interface CreateBootstrapAdminResponse {
  message: string;
  user: {
    id: number;
    username: string;
    userType: UserType;
  };
}
