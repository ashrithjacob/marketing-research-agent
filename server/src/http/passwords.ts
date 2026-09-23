import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/** scrypt password hashing; the ":" separator survives docker compose's .env interpolation. */
export class Passwords {
  private static readonly SCRYPT = { N: 2 ** 14, r: 8, p: 1 };
  private static readonly KEYLEN = 32;
  private static readonly SEPARATOR = ":";
  private static readonly scryptAsync = promisify(scrypt) as (
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
    options: { N: number; r: number; p: number },
  ) => Promise<Buffer>;

  static async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const digest = await Passwords.scryptAsync(password, salt, Passwords.KEYLEN, Passwords.SCRYPT);
    return ["scrypt", salt.toString("base64"), digest.toString("base64")].join(
      Passwords.SEPARATOR,
    );
  }

  static async verify(password: string, encoded: string): Promise<boolean> {
    const parts = encoded.split(Passwords.SEPARATOR);
    if (parts.length !== 3) return false;
    const [scheme, saltB64, digestB64] = parts as [string, string, string];
    if (scheme !== "scrypt") return false;
    let salt: Buffer;
    let expected: Buffer;
    try {
      salt = Buffer.from(saltB64, "base64");
      expected = Buffer.from(digestB64, "base64");
    } catch {
      return false;
    }
    if (expected.length === 0) return false;
    const actual = await Passwords.scryptAsync(password, salt, expected.length, Passwords.SCRYPT);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
