import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createSalaryRuleSchema, listSalaryRulesSchema, updateSalaryRuleSchema } from './schema';
import * as service from './service';

export const salaryRulesRouter = Router();
salaryRulesRouter.use(authenticate, authorize('salary-config:read'));

salaryRulesRouter.get('/', async (req, res) => {
  res.json(await service.list(listSalaryRulesSchema.parse(req.query)));
});

salaryRulesRouter.post('/', authorize('salary-config:write'), async (req, res) => {
  res.status(201).json(await service.create(createSalaryRuleSchema.parse(req.body)));
});

salaryRulesRouter.get('/:id', async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

salaryRulesRouter.patch('/:id', authorize('salary-config:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateSalaryRuleSchema.parse(req.body)));
});

salaryRulesRouter.delete('/:id', authorize('salary-config:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).send();
});
