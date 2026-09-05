import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createWorkScheduleSchema, listWorkSchedulesSchema, updateWorkScheduleSchema } from './schema';
import * as service from './service';

export const workSchedulesRouter = Router();
workSchedulesRouter.use(authenticate);

workSchedulesRouter.get('/', authorize('work-schedules:read'), async (req, res) => {
  res.json(await service.list(listWorkSchedulesSchema.parse(req.query)));
});

workSchedulesRouter.post('/', authorize('work-schedules:write'), async (req, res) => {
  res.status(201).json(await service.create(createWorkScheduleSchema.parse(req.body)));
});

workSchedulesRouter.get('/:id', authorize('work-schedules:read'), async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

workSchedulesRouter.patch('/:id', authorize('work-schedules:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateWorkScheduleSchema.parse(req.body)));
});

workSchedulesRouter.delete('/:id', authorize('work-schedules:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).end();
});
