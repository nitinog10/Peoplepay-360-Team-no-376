import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createContractSchema, listContractsSchema, terminateContractSchema, updateContractSchema } from './schema';
import * as service from './service';

export const contractsRouter = Router();
contractsRouter.use(authenticate);

contractsRouter.get('/', authorize('contracts:read'), async (req, res) => {
  res.json(await service.list(getActor(req), listContractsSchema.parse(req.query)));
});

contractsRouter.post('/', authorize('contracts:write'), async (req, res) => {
  res.status(201).json(await service.create(getActor(req), createContractSchema.parse(req.body)));
});

contractsRouter.get('/:id', authorize('contracts:read'), async (req, res) => {
  res.json(await service.get(getActor(req), parseId(req.params)));
});

contractsRouter.patch('/:id', authorize('contracts:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateContractSchema.parse(req.body)));
});

contractsRouter.post('/:id/terminate', authorize('contracts:write'), async (req, res) => {
  res.json(await service.terminate(parseId(req.params), terminateContractSchema.parse(req.body ?? {})));
});

contractsRouter.delete('/:id', authorize('contracts:write'), async (req, res) => {
  await service.remove(parseId(req.params));
  res.status(204).end();
});
