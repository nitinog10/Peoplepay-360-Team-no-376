import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { payrollDashboardSchema } from './schema';
import { payrollDashboard } from './service';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, authorize('payroll:read'));

dashboardRouter.get('/payroll', async (req, res) => {
  res.json(await payrollDashboard(payrollDashboardSchema.parse(req.query)));
});
