import express from 'express';
import {
  createTest,
  addQuestion,
  replaceTestQuestions,
  updateTestSettings,
  getTest,
  publishTest,
  getClassTests,
  saveTestProgress,
  submitTestAnswers,
  getStudentTestProgress,
  getStudentTestResults,
  getTestAnalytics,
  generateQuizFromPDF
} from '../controllers/testController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticate, authorize('teacher', 'admin'), createTest);
router.post('/generate-from-pdf', authenticate, authorize('teacher', 'admin'), generateQuizFromPDF);
router.post('/:testId/questions', authenticate, authorize('teacher', 'admin'), addQuestion);
router.put('/:testId/questions', authenticate, authorize('teacher', 'admin'), replaceTestQuestions);
router.put('/:testId/settings', authenticate, authorize('teacher', 'admin'), updateTestSettings);
router.put('/:testId/publish', authenticate, authorize('teacher', 'admin'), publishTest);
router.get('/class', authenticate, getClassTests);
router.get('/:testId', authenticate, getTest);
router.get('/:testId/progress', authenticate, authorize('student'), getStudentTestProgress);
router.post('/:testId/save', authenticate, authorize('student'), saveTestProgress);
router.post('/:testId/submit', authenticate, authorize('student'), submitTestAnswers);
router.get('/:testId/results', authenticate, authorize('student', 'teacher', 'admin'), getStudentTestResults);
router.get('/:testId/analytics', authenticate, authorize('teacher', 'admin'), getTestAnalytics);

export default router;
