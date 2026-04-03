import { Request, Response } from 'express';
import pool from '../config/database';

// Create new syllabus
export const createSyllabus = async (req: Request, res: Response) => {
  try {
    const { classId, subjectId, title, description, academicYear, topics } = req.body;
    const teacherId = (req as any).user?.id;

    if (!classId || !subjectId || !title || !teacherId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Insert syllabus
    const syllabusResult = await pool.query(
      `INSERT INTO syllabuses (class_id, subject_id, teacher_id, title, description, academic_year, total_topics, topics_covered, coverage_percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [classId, subjectId, teacherId, title, description || null, academicYear || '2024-2025', topics?.length || 0, 0, 0]
    );

    const syllabusId = syllabusResult.rows[0].id;

    // Insert topics
    if (topics && Array.isArray(topics)) {
      for (const topic of topics) {
        await pool.query(
          `INSERT INTO syllabus_topics (syllabus_id, topic_number, title, description, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [syllabusId, topic.topicNumber, topic.title, topic.description || null, 'pending']
        );
      }
    }

    res.status(201).json({
      message: 'Syllabus created successfully',
      syllabus: syllabusResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating syllabus:', error);
    res.status(500).json({ message: 'Error creating syllabus' });
  }
};

// Get syllabus by class and subject
export const getSyllabusForClass = async (req: Request, res: Response) => {
  try {
    const { classId, subjectId } = req.query;

    if (!classId || !subjectId) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const result = await pool.query(
      `SELECT s.*, 
              array_agg(json_build_object('id', st.id, 'topicNumber', st.topic_number, 'title', st.title, 'status', st.status, 'coveredDate', st.covered_date, 'notes', st.notes) 
               ORDER BY st.topic_number) as topics
       FROM syllabuses s
       LEFT JOIN syllabus_topics st ON s.id = st.syllabus_id
       WHERE s.class_id = $1 AND s.subject_id = $2
       GROUP BY s.id`,
      [parseInt(classId as string), parseInt(subjectId as string)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    res.json({ syllabus: result.rows[0] });
  } catch (error) {
    console.error('Error fetching syllabus:', error);
    res.status(500).json({ message: 'Error fetching syllabus' });
  }
};

// Update topic status
export const updateTopicStatus = async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'ongoing', 'covered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const coveredDate = status === 'covered' ? new Date().toISOString().split('T')[0] : null;

    const result = await pool.query(
      `UPDATE syllabus_topics 
       SET status = $1, covered_date = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, coveredDate, notes || null, parseInt(topicId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Recalculate coverage percentage
    const topic = result.rows[0];
    const syllabusResult = await pool.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN status = 'covered' THEN 1 ELSE 0 END) as covered
       FROM syllabus_topics
       WHERE syllabus_id = $1`,
      [topic.syllabus_id]
    );

    const { total, covered } = syllabusResult.rows[0];
    const coveragePercentage = total > 0 ? Math.round((covered / total) * 100) : 0;

    await pool.query(
      `UPDATE syllabuses 
       SET topics_covered = $1, coverage_percentage = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [covered, coveragePercentage, topic.syllabus_id]
    );

    res.json({
      message: 'Topic updated successfully',
      topic: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ message: 'Error updating topic' });
  }
};

// Get teacher's syllabuses
export const getTeacherSyllabuses = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).user?.id;

    const result = await pool.query(
      `SELECT s.*, c.name as class_name, c.grade, c.section, sb.name as subject_name
       FROM syllabuses s
       JOIN classes c ON s.class_id = c.id
       JOIN subjects sb ON s.subject_id = sb.id
       WHERE s.teacher_id = $1
       ORDER BY s.created_at DESC`,
      [teacherId]
    );

    res.json({ syllabuses: result.rows });
  } catch (error) {
    console.error('Error fetching syllabuses:', error);
    res.status(500).json({ message: 'Error fetching syllabuses' });
  }
};

// Get student's view of syllabus (with coverage percentages)
export const getStudentSyllabus = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ message: 'Missing class ID' });
    }

    const result = await pool.query(
      `SELECT s.*, 
              array_agg(json_build_object('id', st.id, 'topicNumber', st.topic_number, 'title', st.title, 'status', st.status, 'description', st.description) 
               ORDER BY st.topic_number) as topics,
              sb.name as subject_name
       FROM syllabuses s
       LEFT JOIN syllabus_topics st ON s.id = st.syllabus_id
       JOIN subjects sb ON s.subject_id = sb.id
       WHERE s.class_id = $1
       GROUP BY s.id, sb.name
       ORDER BY sb.name`,
      [parseInt(classId as string)]
    );

    res.json({ syllabuses: result.rows });
  } catch (error) {
    console.error('Error fetching student syllabus view:', error);
    res.status(500).json({ message: 'Error fetching syllabus' });
  }
};

// Delete syllabus
export const deleteSyllabus = async (req: Request, res: Response) => {
  try {
    const { syllabusId } = req.params;
    const teacherId = (req as any).user?.id;

    // Verify ownership
    const checkResult = await pool.query(
      'SELECT teacher_id FROM syllabuses WHERE id = $1',
      [parseInt(syllabusId)]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    if (checkResult.rows[0].teacher_id !== teacherId) {
      return res.status(403).json({ message: 'Unauthorized to delete this syllabus' });
    }

    await pool.query('DELETE FROM syllabuses WHERE id = $1', [parseInt(syllabusId)]);

    res.json({ message: 'Syllabus deleted successfully' });
  } catch (error) {
    console.error('Error deleting syllabus:', error);
    res.status(500).json({ message: 'Error deleting syllabus' });
  }
};
