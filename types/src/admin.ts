import type { AdminAccount, AdminUserType } from "./domain.js";

export interface GetAdminsResponse {
  admins: AdminAccount[];
}

export interface GetAdminProfileResponse {
  admin: AdminAccount;
}

export interface UpdateAdminProfileRequest {
  username?: string;
  password?: string;
  currentPassword?: string;
}

export interface UpdateAdminProfileResponse {
  message: string;
  admin: {
    id: number;
    username: string;
    userType: AdminUserType;
  };
  token?: string;
}

export interface CreateAdminRequest {
  username: string;
  password: string;
  userType?: AdminUserType;
}

export interface CreateAdminResponse {
  message: string;
  admin: {
    id: number;
    username: string;
    userType: AdminUserType;
  };
}

export interface UpdateAdminRequest {
  username?: string;
  password?: string;
  userType?: AdminUserType;
}

export interface UpdateAdminResponse {
  message: string;
  admin: {
    id: number;
    username: string;
    userType: AdminUserType;
  };
}

export interface DeleteAdminResponse {
  message: string;
}
