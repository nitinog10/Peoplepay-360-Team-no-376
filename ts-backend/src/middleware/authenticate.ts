import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors';
import { verifyAccessToken, type Actor } from '../lib/security';

/** Requires a valid `Authorization: Bearer <access token>` header. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }
  req.actor = verifyAccessToken(token);
  next();
}

/** Type-safe accessor for handlers mounted behind `authenticate`. */
export function getActor(req: Request): Actor {
  if (!req.actor) throw new UnauthorizedError();
  return req.actor;
}
