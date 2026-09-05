import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  createBalanceSchema,
  initializeYearSchema,
  listBalancesSchema,
  myBalancesSchema,
  recomputeSchema,
  updateBalanceSchema,
} from './schema';
import * as service from './service';

export const leaveBalancesRouter = Router();
leaveBalancesRouter.use(authenticate);

leaveBalancesRouter.get('/me', authorize('leave-balances:read'), async (req, res) => {
  const { year } = myBalancesSchema.parse(req.query);
  res.json(await service.mine(getActor(req), year));
});

leaveBalancesRouter.post('/initialize', authorize('leave-balances:write'), async (req, res) => {
  res.json(await service.initializeYear(initializeYearSchema.parse(req.body)));
});

leaveBalancesRouter.post('/recompute', authorize('leave-balances:write'), async (req, res) => {
  res.json(await service.recompute(recomputeSchema.parse(req.body ?? {})));
});

leaveBalancesRouter.get('/', authorize('leave-balances:read'), async (req, res) => {
  res.json(await service.list(getActor(req), listBalancesSchema.parse(req.query)));
});

leaveBalancesRouter.post('/', authorize('leave-balances:write'), async (req, res) => {
  res.status(201).json(await service.create(createBalanceSchema.parse(req.body)));
});

leaveBalancesRouter.get('/:id', authorize('leave-balances:read'), async (req, res) => {
  res.json(await service.get(getActor(req), parseId(req.params)));
});

leaveBalancesRouter.patch('/:id', authorize('leave-balances:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateBalanceSchema.parse(req.body)));
});

leaveBalancesRouter.delete('/:id', authorize('leave-balances:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).end();
});
