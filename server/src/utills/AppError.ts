/**
 * Custom application error class that extends the native Error class.
 * Allows setting HTTP status codes and custom error messages.
 * 
 * @example
 * ```ts
 * throw new AppError('User not found', 404);
 * throw new AppError('Invalid credentials', 401);
 * ```
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
  }
}

