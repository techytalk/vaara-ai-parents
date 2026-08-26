const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAnonymousHandle(): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `Parent-${suffix}`;
}
