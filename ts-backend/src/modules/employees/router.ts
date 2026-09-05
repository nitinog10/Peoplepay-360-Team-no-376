import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { listContractsSchema } from '../contracts/schema';
import * as contracts from '../contracts/service';
import {
  createAssignmentSchema,
  createEmployeeSchema,
  listEmployeesSchema,
  terminateEmployeeSchema,
  updateAssignmentSchema,
  updateEmployeeSchema,
} from './schema';
import * as service from './service';

export const employeesRouter = Router();
employeesRouter.use(authenticate);

// `/me` routes must be declared before `/:id`.
employeesRouter.get('/me', authorize('employees:read'), async (req, res) => {
  res.json(await service.me(getActor(req)));
});

employeesRouter.get('/me/schedule', authorize('work-schedules:read'), async (req, res) => {
  res.json(await service.mySchedule(getActor(req)));
});

employeesRouter.get('/me/summary', authorize('employees:read'), async (req, res) => {
  const actor = getActor(req);
  res.json(await service.summary(actor, actor.employeeId));
});

employeesRouter.get('/', authorize('employees:read'), async (req, res) => {
  res.json(await service.list(getActor(req), listEmployeesSchema.parse(req.query)));
});

employeesRouter.post('/', authorize('employees:write'), async (req, res) => {
  res.status(201).json(await service.create(createEmployeeSchema.parse(req.body)));
});

employeesRouter.get('/:id', authorize('employees:read'), async (req, res) => {
  res.json(await service.get(getActor(req), parseId(req.params)));
});

employeesRouter.get('/:id/summary', authorize('employees:read'), async (req, res) => {
  res.json(await service.summary(getActor(req), parseId(req.params)));
});

employeesRouter.patch('/:id', authorize('employees:write'), async (req, res) => {
  res.json(await service.update(parseId(req.params), updateEmployeeSchema.parse(req.body)));
});

employeesRouter.post('/:id/terminate', authorize('employees:write'), async (req, res) => {
  res.json(await service.terminate(getActor(req), parseId(req.params), terminateEmployeeSchema.parse(req.body ?? {})));
});

employeesRouter.delete('/:id', authorize('employees:write'), async (req, res) => {
  await service.remove(getActor(req), parseId(req.params));
  res.status(204).end();
});

// ---- related records ----

employeesRouter.get('/:id/contracts', authorize('contracts:read'), async (req, res) => {
  const employeeId = parseId(req.params);
  const query = listContractsSchema.parse({ ...req.query, employeeId });
  res.json(await contracts.list(getActor(req), query));
});

employeesRouter.get('/:id/schedule-assignments', authorize('work-schedules:read'), async (req, res) => {
  res.json(await service.listAssignments(getActor(req), parseId(req.params)));
});

employeesRouter.post('/:id/schedule-assignments', authorize('work-schedules:write'), async (req, res) => {
  res.status(201).json(await service.createAssignment(parseId(req.params), createAssignmentSchema.parse(req.body)));
});

export const scheduleAssignmentsRouter = Router();
scheduleAssignmentsRouter.use(authenticate, authorize('work-schedules:write'));

scheduleAssignmentsRouter.patch('/:id', async (req, res) => {
  res.json(await service.updateAssignment(parseId(req.params), updateAssignmentSchema.parse(req.body)));
});

scheduleAssignmentsRouter.delete('/:id', async (req, res) => {
  await service.removeAssignment(parseId(req.params));
  res.status(204).end();
});
