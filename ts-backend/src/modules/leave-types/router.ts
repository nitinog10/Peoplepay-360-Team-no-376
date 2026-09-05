import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createLeaveTypeSchema, listLeaveTypesSchema, updateLeaveTypeSchema } from './schema';
import * as service from './service';

export const leaveTypesRouter = Router();
leaveTypesRouter.use(authenticate);

leaveTypesRouter.get('/', authorize('leave-types:read'), async (req, res) => {
  res.json(await service.list(listLeaveTypesSchema.parse(req.query)));
});

leaveTypesRouter.post('/', authorize('leave-types:write'), async (req, res) => {
  res.status(201).json(await service.create(createLeaveTypeSchema.parse(req.body)));
});

leaveTypesRouter.get('/:id', authorize('leave-types:read'), async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

leaveTypesRouter.patch('/:id', authorize('leave-types:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateLeaveTypeSchema.parse(req.body)));
});

leaveTypesRouter.delete('/:id', authorize('leave-types:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).end();
});
