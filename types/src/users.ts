import type { ISODateString, PaginationMeta } from "./common.js";
import type { MemberUserType, User } from "./domain.js";

export type UsersListTypeFilter = "admin" | "member" | "non-member";

export interface ListUsersQuery {
  type?: UsersListTypeFilter;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListUsersResponse {
  users: User[];
  pagination: PaginationMeta;
}

export type GetUserByIdResponse = User;

export interface CreateUserRequest {
  username: string;
  credits?: number;
  dateOfBirth?: ISODateString | null;
  userType?: MemberUserType;
}

export interface CreateUserResponse {
  message: string;
  user: {
    id: number;
    username: string;
    credits: number;
    dateOfBirth: ISODateString | null;
    userType: MemberUserType;
  };
}

export interface AddCreditsRequest {
  amount: number;
}

export interface AddCreditsResponse {
  message: string;
  user: {
    id: number;
    username: string;
    credits: number;
  };
}

export interface UpdateUserRequest {
  username?: string;
  dateOfBirth?: ISODateString | null;
  userType?: MemberUserType;
  isActive?: boolean;
}

export interface UpdateUserResponse {
  message: string;
  user: {
    id: number;
    username: string;
    credits: number;
    dateOfBirth: ISODateString | null;
    userType: MemberUserType;
    isActive: boolean;
  };
}

export interface UserCsvExportParams {
  type?: MemberUserType;
}

export interface UserCsvImportResult {
  username: string;
  credits: number;
  userType: MemberUserType;
  dateOfBirth: ISODateString | null;
}

export interface ImportUsersCsvResponse {
  message: string;
  imported: number;
  warnings: number;
  results: UserCsvImportResult[];
  errors: string[];
}
