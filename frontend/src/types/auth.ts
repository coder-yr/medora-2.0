export interface UserBranch {
  id: string;
  name: string;
  code: string;
  isMain?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  group?: string;
  permissions?: string[];
  branches?: UserBranch[];
  branchId?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}
