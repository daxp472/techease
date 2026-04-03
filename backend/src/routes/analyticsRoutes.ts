import express from 'express';
import {
  getClassAnalytics,
  getStudentAnalytics,
  getDashboardStats,
  getClassInterventionSignals
} from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/class/:classId', authenticate, getClassAnalytics);
router.get('/class/:classId/intervention-signals', authenticate, getClassInterventionSignals);
router.get('/student/:studentId', authenticate, getStudentAnalytics);
router.get('/dashboard', authenticate, getDashboardStats);

export default router;
