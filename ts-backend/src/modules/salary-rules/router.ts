import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listSalaryRulesSchema } from './schema';
import * as service from './service';

export const salaryRulesRouter = Router();
salaryRulesRouter.use(authenticate, authorize('salary-config:read'));

salaryRulesRouter.get('/', async (req, res) => {
  res.json(await service.list(listSalaryRulesSchema.parse(req.query)));
});
