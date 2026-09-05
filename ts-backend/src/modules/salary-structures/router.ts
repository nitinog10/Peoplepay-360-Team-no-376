import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listSalaryStructuresSchema } from './schema';
import * as service from './service';

export const salaryStructuresRouter = Router();
salaryStructuresRouter.use(authenticate, authorize('salary-config:read'));

salaryStructuresRouter.get('/', async (req, res) => {
  res.json(await service.list(listSalaryStructuresSchema.parse(req.query)));
});

salaryStructuresRouter.get('/:id', async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});
