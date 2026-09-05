import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  createSalaryStructureSchema,
  listSalaryStructuresSchema,
  reorderSalaryRulesSchema,
  updateSalaryStructureSchema,
} from './schema';
import * as service from './service';

export const salaryStructuresRouter = Router();
salaryStructuresRouter.use(authenticate, authorize('salary-config:read'));

salaryStructuresRouter.get('/', async (req, res) => {
  res.json(await service.list(listSalaryStructuresSchema.parse(req.query)));
});

salaryStructuresRouter.post('/', authorize('salary-config:write'), async (req, res) => {
  res.status(201).json(await service.create(createSalaryStructureSchema.parse(req.body)));
});

salaryStructuresRouter.post('/:id/reorder-rules', authorize('salary-config:write'), async (req, res) => {
  res.json(await service.reorderRules(parseId(req.params), reorderSalaryRulesSchema.parse(req.body)));
});

salaryStructuresRouter.get('/:id', async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

salaryStructuresRouter.patch('/:id', authorize('salary-config:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateSalaryStructureSchema.parse(req.body)));
});

salaryStructuresRouter.delete('/:id', authorize('salary-config:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).send();
});
