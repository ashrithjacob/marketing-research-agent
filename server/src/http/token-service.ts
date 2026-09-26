import { Jwt } from "hono/utils/jwt";
import { Trace } from "../trace/index.js";

/** Issues and validates the session JWT; `tv` is the account's token version, so bumping it revokes the token. */
export class TokenService {
  private readonly secret: string;
  private readonly sessionHours: number;

  constructor(secret: string, options: { sessionHours: number }) {
    Trace.line(import.meta.url, "TokenService.constructor", { secret });
    if (!secret) throw new Error("MRA_JWT_SECRET must be set");
    this.secret = secret;
    this.sessionHours = options.sessionHours;
  }

  async issue(subject: string, version: number): Promise<string> {
    Trace.line(import.meta.url, "TokenService.issue", { subject, version });
    const now = Math.floor(Date.now() / 1000);
    return await Jwt.sign(
      { sub: subject, tv: version, iat: now, exp: now + this.sessionHours * 3600 },
      this.secret,
      "HS256",
    );
  }

  async verify(token: string): Promise<{ subject: string; version: number } | null> {
    Trace.line(import.meta.url, "TokenService.verify", { token });
    try {
      const payload = await Jwt.verify(token, this.secret, "HS256");
      if (typeof payload.sub !== "string" || typeof payload.tv !== "number") return null;
      return { subject: payload.sub, version: payload.tv };
    } catch {
      return null;
    }
  }
}
