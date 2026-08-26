import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const secret = new TextEncoder().encode(JWT_SECRET);

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub) throw new Error("Invalid token");
  return {
    sub: payload.sub,
    email: payload.email as string,
    role: payload.role as string,
  };
}
