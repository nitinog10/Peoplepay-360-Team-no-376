import type { Actor } from '../lib/security';

declare global {
  namespace Express {
    interface Request {
      /** Populated by the `authenticate` middleware. */
      actor?: Actor;
    }
  }
}

export {};
