import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const createStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, classId, rollNumber } = req.body;

    const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await query(
      `INSERT INTO users (email, password, first_name, last_name, role, phone)
       VALUES ($1, $2, $3, $4, 'student', $5)
       RETURNING id, email, first_name, last_name, role, phone, created_at`,
      [email, hashedPassword, firstName, lastName, phone]
    );

    const student = userResult.rows[0];

    if (classId) {
      await query(
        `INSERT INTO enrollments (student_id, class_id, roll_number)
         VALUES ($1, $2, $3)`,
        [student.id, classId, rollNumber]
      );
    }

    res.status(201).json({
      message: 'Student created successfully',
      student: {
        id: student.id,
        email: student.email,
        firstName: student.first_name,
        lastName: student.last_name,
        role: student.role,
        phone: student.phone
      }
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ message: 'Error creating student' });
  }
};

export const getAllStudents = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, search } = req.query;

    let queryText = `
      SELECT DISTINCT
        u.id,
        u.email,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.phone,
        u.profile_image as "profileImage",
        u.created_at as "createdAt",
        e.roll_number as "rollNumber",
        e.status as "enrollmentStatus",
        c.id as "classId",
        c.name as "className",
        c.grade,
        c.section
      FROM users u
    `;
    const params: any[] = [];

    if (classId) {
      queryText += `
        JOIN enrollments e ON u.id = e.student_id AND e.class_id = $1 AND e.status = 'active'
        LEFT JOIN classes c ON e.class_id = c.id
      `;
      params.push(classId);
    } else {
      queryText += `
        LEFT JOIN LATERAL (
          SELECT e1.class_id, e1.roll_number, e1.status
          FROM enrollments e1
          WHERE e1.student_id = u.id AND e1.status = 'active'
          ORDER BY e1.updated_at DESC, e1.id DESC
          LIMIT 1
        ) e ON true
        LEFT JOIN classes c ON e.class_id = c.id
      `;
    }

    queryText += ` WHERE u.role = 'student'`;

    if (search) {
      params.push(`%${search}%`);
      queryText += `
        AND (
          u.first_name ILIKE $${params.length}
          OR u.last_name ILIKE $${params.length}
          OR u.email ILIKE $${params.length}
          OR COALESCE(e.roll_number, '') ILIKE $${params.length}
        )
      `;
    }

    queryText += ' ORDER BY e.roll_number, u.first_name, u.last_name';

    const result = await query(queryText, params);

    res.json({
      students: result.rows
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
};

export const getStudentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.*, e.roll_number, e.status as enrollment_status, e.enrollment_date,
              c.id as class_id, c.name as class_name, c.grade, c.section
       FROM users u
       LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
       LEFT JOIN classes c ON e.class_id = c.id
       WHERE u.id = $1 AND u.role = 'student'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = result.rows[0];

    res.json({
      student: {
        id: student.id,
        email: student.email,
        firstName: student.firstname || student.firstName,
        lastName: student.lastname || student.lastName,
        phone: student.phone,
        profileImage: student.profileimage || student.profileImage,
        rollNumber: student.rollnumber || student.rollNumber || student.roll_number,
        enrollmentStatus: student.enrollmentstatus || student.enrollmentStatus || student.enrollment_status,
        enrollmentDate: student.enrollment_date,
        classId: student.classid || student.classId || student.class_id,
        className: student.classname || student.className || student.class_name,
        grade: student.grade,
        section: student.section,
        createdAt: student.createdat || student.createdAt || student.created_at
      }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Error fetching student' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, profileImage, rollNumber, classId } = req.body;

    const result = await query(
      `UPDATE users
       SET first_name = $1, last_name = $2, phone = $3, profile_image = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND role = 'student'
       RETURNING id, email, first_name, last_name, phone, profile_image`,
      [firstName, lastName, phone, profileImage, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (classId) {
      await query(
        `INSERT INTO enrollments (student_id, class_id, roll_number, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (student_id, class_id)
         DO UPDATE SET roll_number = EXCLUDED.roll_number, status = 'active', updated_at = CURRENT_TIMESTAMP`,
        [id, classId, rollNumber || null]
      );
    }

    res.json({
      message: 'Student updated successfully',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Error updating student' });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      "DELETE FROM users WHERE id = $1 AND role = 'student' RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Error deleting student' });
  }
};

export const enrollStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, classId, rollNumber } = req.body;

    const existingEnrollment = await query(
      'SELECT * FROM enrollments WHERE student_id = $1 AND class_id = $2',
      [studentId, classId]
    );

    if (existingEnrollment.rows.length > 0) {
      return res.status(400).json({ message: 'Student already enrolled in this class' });
    }

    const result = await query(
      `INSERT INTO enrollments (student_id, class_id, roll_number)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [studentId, classId, rollNumber]
    );

    res.status(201).json({
      message: 'Student enrolled successfully',
      enrollment: result.rows[0]
    });
  } catch (error) {
    console.error('Enroll student error:', error);
    res.status(500).json({ message: 'Error enrolling student' });
  }
};
