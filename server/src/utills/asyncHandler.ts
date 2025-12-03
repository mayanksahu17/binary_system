import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to automatically catch errors and pass them to Express error handling middleware.
 * This prevents unhandled promise rejections that can crash the server.
 * 
 * @param fn - Async function that handles the route (req, res, next) => Promise<void>
 * @returns Wrapped function that catches errors and calls next(error)
 * 
 * @example
 * ```ts
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.json(users);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

