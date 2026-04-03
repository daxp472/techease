import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const calculateGrade = (marksObtained: number, maxMarks: number): string => {
  const percentage = (marksObtained / maxMarks) * 100;

  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

export const addGrade = async (req: AuthRequest, res: Response) => {
  try {
    const {
      studentId,
      classId,
      subjectId,
      examTypeId,
      marksObtained,
      maxMarks,
      examDate,
      remarks
    } = req.body;
    const enteredBy = req.user?.id;

    const grade = calculateGrade(marksObtained, maxMarks);

    const result = await query(
      `INSERT INTO grades (student_id, class_id, subject_id, exam_type_id, marks_obtained, max_marks, grade, exam_date, remarks, entered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [studentId, classId, subjectId, examTypeId, marksObtained, maxMarks, grade, examDate, remarks, enteredBy]
    );

    res.status(201).json({
      message: 'Grade added successfully',
      grade: result.rows[0]
    });
  } catch (error) {
    console.error('Add grade error:', error);
    res.status(500).json({ message: 'Error adding grade' });
  }
};

export const updateGrade = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { marksObtained, maxMarks, examDate, remarks } = req.body;

    const grade = calculateGrade(marksObtained, maxMarks);

    const result = await query(
      `UPDATE grades
       SET marks_obtained = $1, max_marks = $2, grade = $3, exam_date = $4, remarks = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [marksObtained, maxMarks, grade, examDate, remarks, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Grade not found' });
    }

    res.json({
      message: 'Grade updated successfully',
      grade: result.rows[0]
    });
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ message: 'Error updating grade' });
  }
};

export const getGradesByClass = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, subjectId, examTypeId } = req.query;

    let queryText = `
            SELECT g.id, g.student_id as studentId, g.class_id as classId, g.subject_id as subjectId, g.exam_type_id as examTypeId,
              g.marks_obtained as marksObtained, g.max_marks as maxMarks, g.grade, g.exam_date as examDate, g.remarks,
              u.first_name as firstName, u.last_name as lastName, u.email,
              e.roll_number as rollNumber,
              s.name as subjectName, s.code as subjectCode,
              et.name as examTypeName
      FROM grades g
      JOIN users u ON g.student_id = u.id
      LEFT JOIN enrollments e ON e.student_id = g.student_id AND e.class_id = g.class_id
      LEFT JOIN subjects s ON g.subject_id = s.id
      LEFT JOIN exam_types et ON g.exam_type_id = et.id
      WHERE g.class_id = $1
    `;
    const params: any[] = [classId];

    if (subjectId) {
      params.push(subjectId);
      queryText += ` AND g.subject_id = $${params.length}`;
    }

    if (examTypeId) {
      params.push(examTypeId);
      queryText += ` AND g.exam_type_id = $${params.length}`;
    }

    queryText += ' ORDER BY e.roll_number, g.exam_date DESC';

    const result = await query(queryText, params);

    res.json({
      grades: result.rows
    });
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ message: 'Error fetching grades' });
  }
};

export const getGradesByStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { classId, subjectId } = req.query;

    let queryText = `
            SELECT g.id, g.student_id as studentId, g.class_id as classId, g.subject_id as subjectId, g.exam_type_id as examTypeId,
              g.marks_obtained as marksObtained, g.max_marks as maxMarks, g.grade, g.exam_date as examDate, g.remarks,
              s.name as subjectName, s.code as subjectCode,
              et.name as examTypeName, et.weightage,
              c.name as className, c.grade as classGrade, c.section
      FROM grades g
      LEFT JOIN subjects s ON g.subject_id = s.id
      LEFT JOIN exam_types et ON g.exam_type_id = et.id
      LEFT JOIN classes c ON g.class_id = c.id
      WHERE g.student_id = $1
    `;
    const params: any[] = [studentId];

    if (classId) {
      params.push(classId);
      queryText += ` AND g.class_id = $${params.length}`;
    }

    if (subjectId) {
      params.push(subjectId);
      queryText += ` AND g.subject_id = $${params.length}`;
    }

    queryText += ' ORDER BY g.exam_date DESC';

    const result = await query(queryText, params);

    res.json({
      grades: result.rows
    });
  } catch (error) {
    console.error('Get student grades error:', error);
    res.status(500).json({ message: 'Error fetching student grades' });
  }
};

export const getReportCard = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, classId } = req.query;

    const studentInfo = await query(
      `SELECT u.id, u.first_name as firstName, u.last_name as lastName, u.email,
              e.roll_number as rollNumber,
              c.name as className, c.grade, c.section
       FROM users u
       JOIN enrollments e ON u.id = e.student_id
       JOIN classes c ON e.class_id = c.id
       WHERE u.id = $1 AND c.id = $2`,
      [studentId, classId]
    );

    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found in this class' });
    }

    const gradesResult = await query(
      `SELECT
         s.id as subjectId,
         s.name as subjectName,
         s.code as subjectCode,
         et.id as examTypeId,
         et.name as examTypeName,
         et.weightage,
         g.marks_obtained,
         g.max_marks,
         g.grade,
         g.exam_date,
         ROUND((g.marks_obtained / g.max_marks * 100), 2) as percentage
       FROM grades g
       JOIN subjects s ON g.subject_id = s.id
       JOIN exam_types et ON g.exam_type_id = et.id
       WHERE g.student_id = $1 AND g.class_id = $2
       ORDER BY s.name, et.weightage DESC`,
      [studentId, classId]
    );

    const subjectWiseStats = await query(
      `SELECT
         s.name as subjectName,
         COUNT(*) as totalExams,
         ROUND(AVG(g.marks_obtained / g.max_marks * 100), 2) as averagePercentage,
         SUM(g.marks_obtained) as totalMarksObtained,
         SUM(g.max_marks) as totalMaxMarks
       FROM grades g
       JOIN subjects s ON g.subject_id = s.id
       WHERE g.student_id = $1 AND g.class_id = $2
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [studentId, classId]
    );

    const overallStats = await query(
      `SELECT
         COUNT(*) as totalExams,
         ROUND(AVG(g.marks_obtained / g.max_marks * 100), 2) as overallPercentage,
         SUM(g.marks_obtained) as totalMarksObtained,
         SUM(g.max_marks) as totalMaxMarks
       FROM grades g
       WHERE g.student_id = $1 AND g.class_id = $2`,
      [studentId, classId]
    );

    res.json({
      student: studentInfo.rows[0],
      grades: gradesResult.rows,
      subjectWiseStats: subjectWiseStats.rows,
      overallStats: overallStats.rows[0]
    });
  } catch (error) {
    console.error('Get report card error:', error);
    res.status(500).json({ message: 'Error generating report card' });
  }
};

export const getExamTypes = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM exam_types ORDER BY weightage DESC');

    res.json({
      examTypes: result.rows
    });
  } catch (error) {
    console.error('Get exam types error:', error);
    res.status(500).json({ message: 'Error fetching exam types' });
  }
};

export const deleteGrade = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM grades WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Grade not found' });
    }

    res.json({
      message: 'Grade deleted successfully'
    });
  } catch (error) {
    console.error('Delete grade error:', error);
    res.status(500).json({ message: 'Error deleting grade' });
  }
};
