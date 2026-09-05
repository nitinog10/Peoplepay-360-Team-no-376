import { Router } from 'express';
import { parseId } from '../../lib/http';
import { authenticate, getActor } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  createRecordSchema,
  entryInputSchema,
  listRecordsSchema,
  markAbsencesSchema,
  punchSchema,
  updateEntrySchema,
  updateRecordSchema,
} from './schema';
import * as service from './service';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// ---- self-service widget ----
attendanceRouter.get('/session', authorize('attendance:punch'), async (req, res) => {
  res.json(await service.session(getActor(req)));
});
attendanceRouter.post('/clock-in', authorize('attendance:punch'), async (req, res) => {
  res.status(201).json(await service.punch(getActor(req), 'CLOCK_IN', punchSchema.parse(req.body ?? {})));
});
attendanceRouter.post('/clock-out', authorize('attendance:punch'), async (req, res) => {
  res.status(201).json(await service.punch(getActor(req), 'CLOCK_OUT', punchSchema.parse(req.body ?? {})));
});
attendanceRouter.post('/break-start', authorize('attendance:punch'), async (req, res) => {
  res.status(201).json(await service.punch(getActor(req), 'BREAK_START', punchSchema.parse(req.body ?? {})));
});
attendanceRouter.post('/break-end', authorize('attendance:punch'), async (req, res) => {
  res.status(201).json(await service.punch(getActor(req), 'BREAK_END', punchSchema.parse(req.body ?? {})));
});

// ---- day close (HR) ----
attendanceRouter.post('/mark-absences', authorize('attendance:write'), async (req, res) => {
  res.json(await service.markAbsences(markAbsencesSchema.parse(req.body)));
});

// ---- records ----
attendanceRouter.get('/records', authorize('attendance:read'), async (req, res) => {
  res.json(await service.list(getActor(req), listRecordsSchema.parse(req.query)));
});
attendanceRouter.post('/records', authorize('attendance:write'), async (req, res) => {
  res.status(201).json(await service.createRecord(createRecordSchema.parse(req.body)));
});
attendanceRouter.get('/records/:id', authorize('attendance:read'), async (req, res) => {
  res.json(await service.get(getActor(req), parseId(req.params)));
});
attendanceRouter.patch('/records/:id', authorize('attendance:write'), async (req, res) => {
  res.json(await service.updateRecord(parseId(req.params), updateRecordSchema.parse(req.body)));
});
attendanceRouter.delete('/records/:id', authorize('attendance:write'), async (req, res) => {
  await service.removeRecord(parseId(req.params));
  res.status(204).end();
});

// ---- entries (HR corrections) ----
attendanceRouter.post('/records/:id/entries', authorize('attendance:write'), async (req, res) => {
  res.status(201).json(await service.addEntry(parseId(req.params), entryInputSchema.parse(req.body)));
});
attendanceRouter.patch('/entries/:id', authorize('attendance:write'), async (req, res) => {
  res.json(await service.updateEntry(parseId(req.params), updateEntrySchema.parse(req.body)));
});
attendanceRouter.delete('/entries/:id', authorize('attendance:write'), async (req, res) => {
  res.json(await service.removeEntry(parseId(req.params)));
});
