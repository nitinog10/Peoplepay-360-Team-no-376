import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createRequestSchema, decisionSchema, listRequestsSchema, updateRequestSchema } from './schema';
import * as service from './service';

export const timeOffRouter = Router();
timeOffRouter.use(authenticate);

timeOffRouter.get('/requests', authorize('time-off:read'), async (req, res) => {
  res.json(await service.list(getActor(req), listRequestsSchema.parse(req.query)));
});

timeOffRouter.post('/requests', authorize('time-off:request'), async (req, res) => {
  res.status(201).json(await service.create(getActor(req), createRequestSchema.parse(req.body)));
});

timeOffRouter.get('/requests/:id', authorize('time-off:read'), async (req, res) => {
  res.json(await service.get(getActor(req), parseId(req.params)));
});

timeOffRouter.patch('/requests/:id', authorize('time-off:request'), async (req, res) => {
  res.json(await service.update(getActor(req), parseId(req.params), updateRequestSchema.parse(req.body)));
});

timeOffRouter.post('/requests/:id/approve', authorize('time-off:decide'), async (req, res) => {
  res.json(await service.approve(getActor(req), parseId(req.params), decisionSchema.parse(req.body ?? {})));
});

timeOffRouter.post('/requests/:id/reject', authorize('time-off:decide'), async (req, res) => {
  res.json(await service.reject(getActor(req), parseId(req.params), decisionSchema.parse(req.body ?? {})));
});

timeOffRouter.post('/requests/:id/cancel', authorize('time-off:request'), async (req, res) => {
  res.json(await service.cancel(getActor(req), parseId(req.params)));
});

timeOffRouter.get('/requests/:id/approval', authorize('time-off:read'), async (req, res) => {
  res.json(await service.getApproval(getActor(req), parseId(req.params)));
});
