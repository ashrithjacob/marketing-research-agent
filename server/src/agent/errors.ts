/** Refusals the HTTP layer turns into a 409: the run is not ours to control. */
export class RunError extends Error {
  override readonly name = "RunError";
}

/** A task that may run only once the owner approves it with a button; the message says what it would spend. */
export class ApprovalNeeded extends RunError {}
