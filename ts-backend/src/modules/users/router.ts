import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createUserSchema, listUsersSchema, updateUserSchema } from './schema';
import * as service from './service';

export const usersRouter = Router();
usersRouter.use(authenticate, authorize('users:manage'));

usersRouter.get('/', async (req, res) => {
  res.json(await service.list(listUsersSchema.parse(req.query)));
});

usersRouter.post('/', async (req, res) => {
  res.status(201).json(await service.create(createUserSchema.parse(req.body)));
});

usersRouter.get('/:id', async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

usersRouter.patch('/:id', async (req, res) => {
  res.json(await service.update(getActor(req), parseId(req.params), updateUserSchema.parse(req.body)));
});

export const rolesRouter = Router();
rolesRouter.use(authenticate, authorize('users:manage'));
rolesRouter.get('/', async (_req, res) => {
  res.json({ data: await service.listRoles() });
});
