import type { Principal } from "../domain/index.js";

/** What the auth middleware leaves on every `/api/research` request's context. */
export type ApiEnv = { Variables: { principal: Principal } };
