export type ErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "PRECONDITION"
  | "CONFLICT"
  | "VALIDATION"
  | "NETWORK"
  | "ABORTED"
  | "HTTP";
export class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
export function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new ServiceError("PRECONDITION", message);
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作未完成，请重试。";
}
