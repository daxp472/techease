import express from 'express';
import {
  markAttendance,
  markBulkAttendance,
  getAttendanceByClass,
  getAttendanceByStudent,
  getAttendanceStats,
  lockAttendanceByClassAndDate,
  getAttendanceLockStatus
} from '../controllers/attendanceController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticate, authorize('teacher', 'admin'), markAttendance);
router.post('/bulk', authenticate, authorize('teacher', 'admin'), markBulkAttendance);
router.post('/lock', authenticate, authorize('teacher', 'admin'), lockAttendanceByClassAndDate);
router.get('/class', authenticate, getAttendanceByClass);
router.get('/lock-status', authenticate, getAttendanceLockStatus);
router.get('/student/:studentId', authenticate, getAttendanceByStudent);
router.get('/stats', authenticate, getAttendanceStats);

export default router;
