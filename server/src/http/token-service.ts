import { Jwt } from "hono/utils/jwt";

/** Issues and validates the session JWT carried in an httpOnly cookie. */
export class TokenService {
  private readonly secret: string;
  private readonly sessionHours: number;

  constructor(secret: string, options: { sessionHours: number }) {
    if (!secret) throw new Error("MRA_JWT_SECRET must be set");
    this.secret = secret;
    this.sessionHours = options.sessionHours;
  }

  async issue(subject: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return await Jwt.sign(
      { sub: subject, iat: now, exp: now + this.sessionHours * 3600 },
      this.secret,
      "HS256",
    );
  }

  async verify(token: string): Promise<string | null> {
    try {
      const payload = await Jwt.verify(token, this.secret, "HS256");
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
