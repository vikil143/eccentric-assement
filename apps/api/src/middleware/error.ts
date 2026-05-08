import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, requestId: req.id },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message, requestId: req.id },
  });
}
