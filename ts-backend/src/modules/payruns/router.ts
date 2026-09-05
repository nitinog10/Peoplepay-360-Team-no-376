import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendPayrunPayslips } from '../payroll/mailer';
import {
  cancelPayrunSchema,
  createPayrunSchema,
  eligibleEmployeesSchema,
  listPayrunsSchema,
} from './schema';
import * as service from './service';

export const payrunsRouter = Router();
payrunsRouter.use(authenticate);

payrunsRouter.get('/', authorize('payroll:read'), async (req, res) => {
  res.json(await service.list(listPayrunsSchema.parse(req.query)));
});

// Static route must precede /:id.
payrunsRouter.get('/eligible-employees', authorize('payroll:read'), async (req, res) => {
  res.json(await service.eligibleEmployees(eligibleEmployeesSchema.parse(req.query)));
});

payrunsRouter.post('/', authorize('payruns:write'), async (req, res) => {
  res.status(201).json(await service.create(getActor(req), createPayrunSchema.parse(req.body)));
});

payrunsRouter.get('/:id', authorize('payroll:read'), async (req, res) => {
  res.json(await service.get(parseId(req.params)));
});

payrunsRouter.delete('/:id', authorize('payruns:delete'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).send();
});

payrunsRouter.post('/:id/compute', authorize('payruns:write'), async (req, res) => {
  res.json(await service.compute(parseId(req.params)));
});

payrunsRouter.get('/:id/warnings', authorize('payroll:read'), async (req, res) => {
  res.json(await service.warnings(parseId(req.params)));
});

payrunsRouter.post('/:id/validate', authorize('payruns:write'), async (req, res) => {
  res.json(await service.validate(getActor(req), parseId(req.params)));
});

payrunsRouter.post('/:id/mark-paid', authorize('payruns:write'), async (req, res) => {
  res.json(await service.markPaid(getActor(req), parseId(req.params)));
});

payrunsRouter.post('/:id/cancel', authorize('payruns:write'), async (req, res) => {
  res.json(await service.cancel(getActor(req), parseId(req.params), cancelPayrunSchema.parse(req.body)));
});

payrunsRouter.post('/:id/send-payslips', authorize('payruns:write'), async (req, res) => {
  res.json(await sendPayrunPayslips(parseId(req.params)));
});
