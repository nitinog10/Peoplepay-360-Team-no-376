import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission } from '../auth/permissions';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

/**
 * Gate a route behind one or more permissions (all required).
 * Must run after `authenticate`.
 */
export function authorize(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const actor = req.actor;
    if (!actor) {
      next(new UnauthorizedError());
      return;
    }
    const missing = required.filter((p) => !hasPermission(actor.role, p));
    if (missing.length > 0) {
      next(new ForbiddenError(`Missing permission: ${missing.join(', ')}`));
      return;
    }
    next();
  };
}
