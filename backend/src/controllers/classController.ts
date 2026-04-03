import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const createClass = async (req: AuthRequest, res: Response) => {
  try {
    const { name, grade, section, academicYear, teacherId, roomNumber } = req.body;

    const result = await query(
      `INSERT INTO classes (name, grade, section, academic_year, teacher_id, room_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, grade, section, academicYear, teacherId, roomNumber]
    );

    res.status(201).json({
      message: 'Class created successfully',
      class: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Class with this grade, section, and academic year already exists' });
    }
    console.error('Create class error:', error);
    res.status(500).json({ message: 'Error creating class' });
  }
};

export const getAllClasses = async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId, academicYear } = req.query;

    let queryText = `
            SELECT c.id, c.name, c.grade, c.section, c.academic_year as academicYear, c.teacher_id as teacherId, c.room_number as roomNumber,
              u.first_name as teacherFirstName,
              u.last_name as teacherLastName,
              COUNT(DISTINCT e.student_id) as studentCount
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.class_id AND e.status = 'active'
      WHERE 1=1
    `;
    const params: any[] = [];

    if (teacherId) {
      params.push(teacherId);
      queryText += ` AND c.teacher_id = $${params.length}`;
    }

    if (academicYear) {
      params.push(academicYear);
      queryText += ` AND c.academic_year = $${params.length}`;
    }

    queryText += ' GROUP BY c.id, u.first_name, u.last_name ORDER BY c.grade, c.section';

    const result = await query(queryText, params);

    res.json({
      classes: result.rows
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ message: 'Error fetching classes' });
  }
};

export const getClassById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.id, c.name, c.grade, c.section, c.academic_year as academicYear, c.teacher_id as teacherId, c.room_number as roomNumber,
              u.first_name as teacherFirstName,
              u.last_name as teacherLastName,
              u.email as teacherEmail,
              COUNT(DISTINCT e.student_id) as studentCount
       FROM classes c
       LEFT JOIN users u ON c.teacher_id = u.id
       LEFT JOIN enrollments e ON c.id = e.class_id AND e.status = 'active'
       WHERE c.id = $1
       GROUP BY c.id, u.first_name, u.last_name, u.email`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({
      class: result.rows[0]
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ message: 'Error fetching class' });
  }
};

export const updateClass = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, grade, section, academicYear, teacherId, roomNumber } = req.body;

    const result = await query(
      `UPDATE classes
       SET name = $1, grade = $2, section = $3, academic_year = $4, teacher_id = $5, room_number = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, grade, section, academicYear, teacherId, roomNumber, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({
      message: 'Class updated successfully',
      class: result.rows[0]
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ message: 'Error updating class' });
  }
};

export const deleteClass = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM classes WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json({
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ message: 'Error deleting class' });
  }
};

export const getClassStudents = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.id, u.email, u.first_name as firstName, u.last_name as lastName, u.phone, u.profile_image as profileImage,
              e.roll_number as rollNumber, e.enrollment_date as enrollmentDate, e.status as enrollmentStatus
       FROM users u
       JOIN enrollments e ON u.id = e.student_id
       WHERE e.class_id = $1 AND u.role = 'student'
       ORDER BY e.roll_number`,
      [id]
    );

    res.json({
      students: result.rows
    });
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ message: 'Error fetching class students' });
  }
};

export const getSubjects = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT id, name, code, description FROM subjects ORDER BY name');

    res.json({
      subjects: result.rows
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ message: 'Error fetching subjects' });
  }
};

export const assignSubjectToClass = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, subjectId, teacherId } = req.body;

    const result = await query(
      `INSERT INTO class_subjects (class_id, subject_id, teacher_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, subject_id) DO UPDATE SET teacher_id = $3
       RETURNING *`,
      [classId, subjectId, teacherId]
    );

    res.status(201).json({
      message: 'Subject assigned to class successfully',
      classSubject: result.rows[0]
    });
  } catch (error) {
    console.error('Assign subject error:', error);
    res.status(500).json({ message: 'Error assigning subject to class' });
  }
};
