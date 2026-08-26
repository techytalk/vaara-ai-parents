export type UserRole = "parent" | "provider";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  anonymousHandle: string;
  onboardingComplete: boolean;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};
