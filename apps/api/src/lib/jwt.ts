import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const secret = new TextEncoder().encode(JWT_SECRET);

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  /** Bumped on deactivation to invalidate outstanding tokens. */
  sessionVersion: number;
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    sv: payload.sessionVersion,
  })
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
    sessionVersion:
      typeof payload.sv === "number"
        ? payload.sv
        : Number(payload.sv ?? 0) || 0,
  };
}

/** Ops console session (Circles admin, seed tools, school merge). */
export type AdminJwtPayload = {
  email: string;
  role: "ops_admin";
};

export async function signAdminToken(email: string): Promise<string> {
  return new SignJWT({
    email,
    role: "ops_admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(`ops:${email}`)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.role !== "ops_admin" || typeof payload.email !== "string") {
    throw new Error("Invalid admin token");
  }
  return { email: payload.email, role: "ops_admin" };
}
