import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const createTimetableEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber } = req.body;

    const conflictCheck = await query(
      `SELECT * FROM timetable
       WHERE teacher_id = $1 AND day_of_week = $2
       AND (
         (start_time <= $3 AND end_time > $3) OR
         (start_time < $4 AND end_time >= $4) OR
         (start_time >= $3 AND end_time <= $4)
       )`,
      [teacherId, dayOfWeek, startTime, endTime]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Teacher has a scheduling conflict at this time' });
    }

    const result = await query(
      `INSERT INTO timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber]
    );

    res.status(201).json({
      message: 'Timetable entry created successfully',
      timetable: result.rows[0]
    });
  } catch (error) {
    console.error('Create timetable error:', error);
    res.status(500).json({ message: 'Error creating timetable entry' });
  }
};

export const getTimetableByClass = async (req: AuthRequest, res: Response) => {
  try {
    const { classId } = req.params;

    const result = await query(
            `SELECT t.id, t.class_id as classId, t.subject_id as subjectId, t.teacher_id as teacherId, t.day_of_week as dayOfWeek,
              t.start_time as startTime, t.end_time as endTime, t.room_number as roomNumber,
              s.name as subjectName, s.code as subjectCode,
              u.first_name as teacherFirstName, u.last_name as teacherLastName,
              c.name as className, c.grade, c.section
       FROM timetable t
       LEFT JOIN subjects s ON t.subject_id = s.id
       LEFT JOIN users u ON t.teacher_id = u.id
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.class_id = $1
       ORDER BY t.day_of_week, t.start_time`,
      [classId]
    );

    res.json({
      timetable: result.rows
    });
  } catch (error) {
    console.error('Get class timetable error:', error);
    res.status(500).json({ message: 'Error fetching class timetable' });
  }
};

export const getTimetableByTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.params.teacherId || req.user?.id;

    const result = await query(
            `SELECT t.id, t.class_id as classId, t.subject_id as subjectId, t.teacher_id as teacherId, t.day_of_week as dayOfWeek,
              t.start_time as startTime, t.end_time as endTime, t.room_number as roomNumber,
              s.name as subjectName, s.code as subjectCode,
              c.name as className, c.grade, c.section
       FROM timetable t
       LEFT JOIN subjects s ON t.subject_id = s.id
       LEFT JOIN classes c ON t.class_id = c.id
       WHERE t.teacher_id = $1
       ORDER BY t.day_of_week, t.start_time`,
      [teacherId]
    );

    res.json({
      timetable: result.rows
    });
  } catch (error) {
    console.error('Get teacher timetable error:', error);
    res.status(500).json({ message: 'Error fetching teacher timetable' });
  }
};

export const updateTimetableEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber } = req.body;

    const conflictCheck = await query(
      `SELECT * FROM timetable
       WHERE teacher_id = $1 AND day_of_week = $2 AND id != $3
       AND (
         (start_time <= $4 AND end_time > $4) OR
         (start_time < $5 AND end_time >= $5) OR
         (start_time >= $4 AND end_time <= $5)
       )`,
      [teacherId, dayOfWeek, id, startTime, endTime]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Teacher has a scheduling conflict at this time' });
    }

    const result = await query(
      `UPDATE timetable
       SET class_id = $1, subject_id = $2, teacher_id = $3, day_of_week = $4,
           start_time = $5, end_time = $6, room_number = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }

    res.json({
      message: 'Timetable entry updated successfully',
      timetable: result.rows[0]
    });
  } catch (error) {
    console.error('Update timetable error:', error);
    res.status(500).json({ message: 'Error updating timetable entry' });
  }
};

export const deleteTimetableEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM timetable WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }

    res.json({
      message: 'Timetable entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete timetable error:', error);
    res.status(500).json({ message: 'Error deleting timetable entry' });
  }
};
