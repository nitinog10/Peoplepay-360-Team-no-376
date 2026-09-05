import { Router } from 'express';
import { prisma } from './lib/prisma';
import { attendanceRouter } from './modules/attendance/router';
import { authRouter } from './modules/auth/router';
import { contractsRouter } from './modules/contracts/router';
import { departmentsRouter } from './modules/departments/router';
import { employeesRouter, scheduleAssignmentsRouter } from './modules/employees/router';
import { leaveBalancesRouter } from './modules/leave-balances/router';
import { leaveTypesRouter } from './modules/leave-types/router';
import { payrunsRouter } from './modules/payruns/router';
import { payslipsRouter } from './modules/payslips/router';
import { salaryRulesRouter } from './modules/salary-rules/router';
import { salaryStructuresRouter } from './modules/salary-structures/router';
import { timeOffRouter } from './modules/time-off/router';
import { rolesRouter, usersRouter } from './modules/users/router';
import { workSchedulesRouter } from './modules/work-schedules/router';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/leave-types', leaveTypesRouter);
apiRouter.use('/work-schedules', workSchedulesRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/schedule-assignments', scheduleAssignmentsRouter);
apiRouter.use('/contracts', contractsRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/leave-balances', leaveBalancesRouter);
apiRouter.use('/time-off', timeOffRouter);
apiRouter.use('/salary-structures', salaryStructuresRouter);
apiRouter.use('/salary-rules', salaryRulesRouter);
apiRouter.use('/payruns', payrunsRouter);
apiRouter.use('/payslips', payslipsRouter);
