/** Refusals the HTTP layer turns into a 409: the run is not ours to control. */
export class RunError extends Error {
  override readonly name = "RunError";
}
