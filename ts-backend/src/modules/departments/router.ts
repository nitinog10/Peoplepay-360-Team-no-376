import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createDepartmentSchema, listDepartmentsSchema, updateDepartmentSchema } from './schema';
import * as service from './service';

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);

departmentsRouter.get('/', authorize('departments:read'), async (req, res) => {
  res.json(await service.list(listDepartmentsSchema.parse(req.query)));
});

departmentsRouter.post('/', authorize('departments:write'), async (req, res) => {
  res.status(201).json(await service.create(createDepartmentSchema.parse(req.body)));
});

departmentsRouter.get('/:id', authorize('departments:read'), async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

departmentsRouter.patch('/:id', authorize('departments:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateDepartmentSchema.parse(req.body)));
});

departmentsRouter.delete('/:id', authorize('departments:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).end();
});
