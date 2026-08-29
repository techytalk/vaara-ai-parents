import { signToken } from "./jwt.js";
import { resolveAvatarKey } from "./avatar.js";

type UserAuthRow = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  anonymous_handle: string;
  onboarding_complete: boolean;
  avatar_key?: string | null;
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
      avatarKey: resolveAvatarKey(user.avatar_key, user.anonymous_handle),
    },
  };
}
