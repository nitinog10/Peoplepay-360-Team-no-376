import { Router, type Response } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../lib/errors';
import { authenticate, getActor } from '../../middleware/authenticate';
import { loginSchema, refreshSchema } from './schema';
import * as service from './service';

export const REFRESH_COOKIE = 'pp360_refresh';
const COOKIE_PATH = '/api/v1/auth';

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: COOKIE_PATH });
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const session = await service.login(input);
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  res.json(session);
});

authRouter.post('/refresh', async (req, res) => {
  const body = refreshSchema.parse(req.body ?? {});
  const raw: string | undefined = body.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw new UnauthorizedError('Refresh token missing');
  const session = await service.refresh(raw);
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  res.json(session);
});

authRouter.post('/logout', async (req, res) => {
  const body = refreshSchema.parse(req.body ?? {});
  await service.logout(body.refreshToken ?? req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  res.json(await service.me(getActor(req)));
});
