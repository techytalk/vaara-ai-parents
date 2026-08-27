import { signToken } from "./jwt.js";

type UserAuthRow = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  anonymous_handle: string;
  onboarding_complete: boolean;
};

export async function buildAuthResponse(user: UserAuthRow) {
  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      anonymousHandle: user.anonymous_handle,
      onboardingComplete: user.onboarding_complete,
    },
  };
}
