import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const isAttendanceLocked = async (classId: number, date: string) => {
  const lockResult = await query(
    'SELECT id FROM attendance_locks WHERE class_id = $1 AND date = $2',
    [classId, date]
  );
  return lockResult.rows.length > 0;
};

export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, classId, subjectId, date, status, remarks } = req.body;
    const markedBy = req.user?.id;

    if (await isAttendanceLocked(classId, date)) {
      return res.status(409).json({ message: 'Attendance is locked for this class and date' });
    }

    const result = await query(
      `INSERT INTO attendance (student_id, class_id, subject_id, date, status, remarks, marked_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (student_id, class_id, subject_id, date)
       DO UPDATE SET status = $5, remarks = $6, marked_by = $7, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [studentId, classId, subjectId, date, status, remarks, markedBy]
    );

    res.status(201).json({
      message: 'Attendance marked successfully',
      attendance: result.rows[0]
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ message: 'Error marking attendance' });
  }
};

export const markBulkAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { attendanceRecords } = req.body;
    const markedBy = req.user?.id;

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({ message: 'No attendance records provided' });
    }

    const sample = attendanceRecords[0];
    if (await isAttendanceLocked(sample.classId, sample.date)) {
      return res.status(409).json({ message: 'Attendance is locked for this class and date' });
    }

    const valuesClause = attendanceRecords
      .map((_: any, index: number) => {
        const offset = index * 7;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      })
      .join(',');

    const params = attendanceRecords.flatMap((record: any) => [
      record.studentId,
      record.classId,
      record.subjectId,
      record.date,
      record.status,
      record.remarks || null,
      markedBy || null
    ]);

    await query(
      `INSERT INTO attendance (student_id, class_id, subject_id, date, status, remarks, marked_by)
       VALUES ${valuesClause}
       ON CONFLICT (student_id, class_id, subject_id, date)
       DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, marked_by = EXCLUDED.marked_by, updated_at = CURRENT_TIMESTAMP`,
      params
    );

    res.status(201).json({
      message: 'Bulk attendance marked successfully',
      count: attendanceRecords.length
    });
  } catch (error) {
    console.error('Mark bulk attendance error:', error);
    res.status(500).json({ message: 'Error marking bulk attendance' });
  }
};

export const getAttendanceByClass = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, date, subjectId } = req.query;

    let queryText = `
      SELECT a.*,
             u.first_name, u.last_name, u.email,
             e.roll_number,
             s.name as subject_name
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      LEFT JOIN enrollments e ON e.student_id = a.student_id AND e.class_id = a.class_id
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE a.class_id = $1
    `;
    const params: any[] = [classId];

    if (date) {
      params.push(date);
      queryText += ` AND a.date = $${params.length}`;
    }

    if (subjectId) {
      params.push(subjectId);
      queryText += ` AND a.subject_id = $${params.length}`;
    }

    queryText += ' ORDER BY e.roll_number, a.date DESC';

    const result = await query(queryText, params);

    let locked = false;
    if (classId && date) {
      locked = await isAttendanceLocked(Number(classId), String(date));
    }

    res.json({
      attendance: result.rows,
      locked
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Error fetching attendance' });
  }
};

export const lockAttendanceByClassAndDate = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, date } = req.body;
    const lockedBy = req.user?.id;

    if (!classId || !date) {
      return res.status(400).json({ message: 'classId and date are required' });
    }

    await query(
      `INSERT INTO attendance_locks (class_id, date, locked_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, date) DO NOTHING`,
      [classId, date, lockedBy || null]
    );

    return res.json({ message: 'Attendance locked successfully' });
  } catch (error) {
    console.error('Lock attendance error:', error);
    return res.status(500).json({ message: 'Error locking attendance' });
  }
};

export const getAttendanceLockStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, date } = req.query;

    if (!classId || !date) {
      return res.status(400).json({ message: 'classId and date are required' });
    }

    const locked = await isAttendanceLocked(Number(classId), String(date));
    return res.json({ locked });
  } catch (error) {
    console.error('Get attendance lock status error:', error);
    return res.status(500).json({ message: 'Error checking attendance lock status' });
  }
};

export const getAttendanceByStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, subjectId } = req.query;

    let queryText = `
      SELECT a.*,
             c.name as class_name, c.grade, c.section,
             s.name as subject_name
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE a.student_id = $1
    `;
    const params: any[] = [studentId];

    if (startDate) {
      params.push(startDate);
      queryText += ` AND a.date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND a.date <= $${params.length}`;
    }

    if (subjectId) {
      params.push(subjectId);
      queryText += ` AND a.subject_id = $${params.length}`;
    }

    queryText += ' ORDER BY a.date DESC';

    const result = await query(queryText, params);

    const statsQuery = await query(
      `SELECT
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days,
        ROUND(COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 2) as attendance_percentage
       FROM attendance
       WHERE student_id = $1
       ${startDate ? `AND date >= $2` : ''}
       ${endDate ? `AND date <= $${startDate ? 3 : 2}` : ''}`,
      startDate && endDate ? [studentId, startDate, endDate] :
      startDate ? [studentId, startDate] :
      endDate ? [studentId, endDate] : [studentId]
    );

    res.json({
      attendance: result.rows,
      statistics: statsQuery.rows[0]
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ message: 'Error fetching student attendance' });
  }
};

export const getAttendanceStats = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, startDate, endDate } = req.query;

    let queryText = `
      SELECT
        u.id as student_id,
        u.first_name,
        u.last_name,
        e.roll_number,
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE a.status = 'present') as present_days,
        COUNT(*) FILTER (WHERE a.status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE a.status = 'late') as late_days,
        ROUND(COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 2) as attendance_percentage
      FROM users u
      JOIN enrollments e ON u.id = e.student_id
      LEFT JOIN attendance a ON u.id = a.student_id AND a.class_id = e.class_id
      WHERE e.class_id = $1 AND e.status = 'active'
    `;
    const params: any[] = [classId];

    if (startDate) {
      params.push(startDate);
      queryText += ` AND a.date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND a.date <= $${params.length}`;
    }

    queryText += ' GROUP BY u.id, u.first_name, u.last_name, e.roll_number ORDER BY e.roll_number';

    const result = await query(queryText, params);

    res.json({
      statistics: result.rows
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Error fetching attendance statistics' });
  }
};
