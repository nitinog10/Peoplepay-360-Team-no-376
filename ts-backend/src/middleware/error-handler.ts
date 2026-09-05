import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function send(res: Response, status: number, code: string, message: string, details?: unknown): void {
  const body: ErrorBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    send(
      res,
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
    return;
  }

  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        send(res, 409, 'UNIQUE_VIOLATION', 'A record with the same unique value already exists', {
          target: err.meta?.target,
        });
        return;
      case 'P2003':
        send(res, 409, 'FOREIGN_KEY_VIOLATION', 'Referenced record does not exist or is still in use', {
          field: err.meta?.field_name,
        });
        return;
      case 'P2025':
        send(res, 404, 'NOT_FOUND', 'Record not found');
        return;
      default:
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    send(res, 400, 'BAD_REQUEST', 'Invalid data for database operation');
    return;
  }

  // Body-parser JSON syntax errors carry a 400 status.
  const maybeHttp = err as { status?: number; type?: string; message?: string };
  if (maybeHttp?.status === 400 && maybeHttp.type === 'entity.parse.failed') {
    send(res, 400, 'BAD_REQUEST', 'Malformed JSON body');
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
}
