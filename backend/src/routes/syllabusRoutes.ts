import express from 'express';
import {
  createSyllabus,
  getSyllabusForClass,
  updateTopicStatus,
  getTeacherSyllabuses,
  getStudentSyllabus,
  deleteSyllabus
} from '../controllers/syllabusController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticate, authorize('teacher', 'admin'), createSyllabus);
router.get('/teacher', authenticate, authorize('teacher', 'admin'), getTeacherSyllabuses);
router.get('/class', authenticate, getSyllabusForClass);
router.get('/student-view', authenticate, authorize('student', 'teacher', 'admin'), getStudentSyllabus);
router.patch('/topics/:topicId/status', authenticate, authorize('teacher', 'admin'), updateTopicStatus);
router.delete('/:syllabusId', authenticate, authorize('teacher', 'admin'), deleteSyllabus);

export default router;
