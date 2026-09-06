import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listPayslipsSchema } from './schema';
import * as service from './service';

export const payslipsRouter = Router();
payslipsRouter.use(authenticate);

payslipsRouter.get('/', authorize('payslips:read'), async (req, res) => {
  res.json(await service.list(getActor(req), listPayslipsSchema.parse(req.query)));
});

payslipsRouter.get('/:id', authorize('payslips:read'), async (req, res) => {
  res.json(await service.get(getActor(req), parseId(req.params)));
});

payslipsRouter.delete('/:id', authorize('payslips:delete'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).send();
});

payslipsRouter.post('/:id/recompute', authorize('payslips:write'), async (req, res) => {
  res.json(await service.recompute(getActor(req), parseId(req.params)));
});

payslipsRouter.get('/:id/pdf', authorize('payslips:read'), async (req, res) => {
  const result = await service.pdf(getActor(req), parseId(req.params));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Content-Length', result.buffer.length);
  res.send(result.buffer);
});
