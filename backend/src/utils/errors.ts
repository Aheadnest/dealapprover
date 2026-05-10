export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: () => new AppError("UNAUTHORIZED", "Authentication required", 401),
  forbidden: () => new AppError("FORBIDDEN", "Access denied", 403),
  notFound: (resource = "Resource") =>
    new AppError("NOT_FOUND", `${resource} not found`, 404),
  conflict: (msg: string) => new AppError("CONFLICT", msg, 409),
  quotaExceeded: () =>
    new AppError("QUOTA_EXCEEDED", "Monthly certificate quota exceeded. Upgrade to Pro for unlimited certificates.", 402),
  emailNotVerified: () =>
    new AppError("EMAIL_NOT_VERIFIED", "Email address must be verified before issuing certificates", 403),
  validation: (msg: string) => new AppError("VALIDATION_ERROR", msg, 400),
  internal: (msg = "Internal server error") =>
    new AppError("INTERNAL_ERROR", msg, 500),
};
