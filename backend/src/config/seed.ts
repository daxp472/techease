import bcrypt from 'bcryptjs';
import pool from './database';

export const seedDatabase = async () => {
  try {
    console.log('Seeding database with demo data...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role, phone)
       VALUES
         ('teacher@demo.com', $1, 'John', 'Smith', 'teacher', '123-456-7890'),
         ('student1@demo.com', $1, 'Alice', 'Johnson', 'student', '123-456-7891'),
         ('student2@demo.com', $1, 'Bob', 'Williams', 'student', '123-456-7892'),
         ('student3@demo.com', $1, 'Charlie', 'Brown', 'student', '123-456-7893'),
         ('student4@demo.com', $1, 'Diana', 'Davis', 'student', '123-456-7894'),
         ('student5@demo.com', $1, 'Eve', 'Martinez', 'student', '123-456-7895'),
         ('student6@demo.com', $1, 'Fiona', 'Clark', 'student', '123-456-7896'),
         ('student7@demo.com', $1, 'George', 'Lopez', 'student', '123-456-7897'),
         ('student8@demo.com', $1, 'Hannah', 'Young', 'student', '123-456-7898'),
         ('student9@demo.com', $1, 'Ian', 'King', 'student', '123-456-7899'),
         ('student10@demo.com', $1, 'Julia', 'Scott', 'student', '123-456-7900')
       ON CONFLICT (email) DO NOTHING`,
      [hashedPassword]
    );

    const teacherResult = await pool.query(
      `SELECT id FROM users WHERE email = 'teacher@demo.com' LIMIT 1`
    );
    const teacherId = teacherResult.rows[0]?.id;

    await pool.query(
      `INSERT INTO classes (name, grade, section, academic_year, teacher_id, room_number)
       VALUES
         ('Mathematics A', '10', 'A', '2024-2025', $1, '101'),
         ('Science B', '10', 'B', '2024-2025', $1, '102')
       ON CONFLICT (grade, section, academic_year) DO NOTHING`
      ,
      [teacherId]
    );

    await pool.query(
      `UPDATE classes
       SET teacher_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE academic_year = '2024-2025' AND grade = '10' AND section IN ('A', 'B')`,
      [teacherId]
    );

    await pool.query(
      `UPDATE timetable t
       SET teacher_id = $1, updated_at = CURRENT_TIMESTAMP
       FROM classes c
       WHERE t.class_id = c.id
         AND c.academic_year = '2024-2025'
         AND c.grade = '10'
         AND c.section IN ('A', 'B')`,
      [teacherId]
    );

    await pool.query(
      `WITH target_enrollments AS (
         SELECT u.id as student_id, c.id as class_id, v.roll_number
         FROM (VALUES
           ('student1@demo.com', '10', 'A', '001'),
           ('student2@demo.com', '10', 'A', '002'),
           ('student3@demo.com', '10', 'A', '003'),
           ('student4@demo.com', '10', 'A', '004'),
           ('student5@demo.com', '10', 'A', '005'),
           ('student6@demo.com', '10', 'B', '001'),
           ('student7@demo.com', '10', 'B', '002'),
           ('student8@demo.com', '10', 'B', '003'),
           ('student9@demo.com', '10', 'B', '004'),
           ('student10@demo.com', '10', 'B', '005')
         ) AS v(email, grade, section, roll_number)
         JOIN users u ON u.email = v.email
         JOIN classes c ON c.grade = v.grade AND c.section = v.section AND c.academic_year = '2024-2025'
       )
       INSERT INTO enrollments (student_id, class_id, roll_number, status)
       SELECT student_id, class_id, roll_number, 'active'
       FROM target_enrollments
       ON CONFLICT (student_id, class_id)
       DO UPDATE
         SET roll_number = EXCLUDED.roll_number,
             status = 'active',
             updated_at = CURRENT_TIMESTAMP`
    );
    
      // Seed Timetable Data - Full week schedule for classes
      await pool.query(
        `INSERT INTO timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number)
         VALUES
           -- Monday (1)
           (1, 1, 1, 1, '09:00', '10:00', '101'),
           (1, 3, 1, 1, '10:15', '11:15', '101'),
           (2, 2, 1, 1, '11:30', '12:30', '102'),
           (2, 4, 1, 1, '13:30', '14:30', '102'),
           -- Tuesday (2)
           (1, 1, 1, 2, '09:00', '10:00', '101'),
           (1, 2, 1, 2, '10:15', '11:15', '101'),
           (2, 4, 1, 2, '11:30', '12:30', '102'),
           (2, 5, 1, 2, '13:30', '14:30', '102'),
           -- Wednesday (3)
           (1, 3, 1, 3, '09:00', '10:00', '101'),
           (1, 1, 1, 3, '10:15', '11:15', '101'),
           (2, 5, 1, 3, '11:30', '12:30', '102'),
           (2, 2, 1, 3, '13:30', '14:30', '102'),
           -- Thursday (4)
           (1, 2, 1, 4, '09:00', '10:00', '101'),
           (1, 4, 1, 4, '10:15', '11:15', '101'),
           (2, 5, 1, 4, '11:30', '12:30', '102'),
           (2, 1, 1, 4, '13:30', '14:30', '102'),
           -- Friday (5)
           (1, 6, 1, 5, '09:00', '10:00', '101'),
           (1, 4, 1, 5, '10:15', '11:15', '101'),
           (2, 2, 1, 5, '11:30', '12:30', '102'),
           (2, 3, 1, 5, '13:30', '14:30', '102')
         ON CONFLICT DO NOTHING`
      );

    // Seed syllabus and topics
    await pool.query(
      `INSERT INTO syllabuses (class_id, subject_id, teacher_id, title, description, academic_year, total_topics, topics_covered, coverage_percentage)
       VALUES
         (1, 1, 1, 'Mathematics Term Plan', 'Grade 10 Mathematics complete term syllabus', '2024-2025', 6, 2, 33.33),
         (2, 2, 1, 'Science Foundations', 'Core science topics for Grade 10 Section B', '2024-2025', 5, 1, 20.00)
       ON CONFLICT (class_id, subject_id, academic_year) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO syllabus_topics (syllabus_id, topic_number, title, status)
       SELECT s.id, t.topic_number, t.title, t.status
       FROM syllabuses s
       JOIN (
         VALUES
           ('Mathematics Term Plan', 1, 'Linear Equations', 'covered'),
           ('Mathematics Term Plan', 2, 'Quadratic Equations', 'covered'),
           ('Mathematics Term Plan', 3, 'Polynomials', 'ongoing'),
           ('Mathematics Term Plan', 4, 'Trigonometry Basics', 'pending'),
           ('Mathematics Term Plan', 5, 'Statistics', 'pending'),
           ('Mathematics Term Plan', 6, 'Probability', 'pending'),
           ('Science Foundations', 1, 'Matter and Materials', 'covered'),
           ('Science Foundations', 2, 'Atomic Structure', 'ongoing'),
           ('Science Foundations', 3, 'Chemical Reactions', 'pending'),
           ('Science Foundations', 4, 'Motion and Forces', 'pending'),
           ('Science Foundations', 5, 'Energy and Work', 'pending')
       ) AS t(syllabus_title, topic_number, title, status)
         ON s.title = t.syllabus_title
       ON CONFLICT (syllabus_id, topic_number) DO NOTHING`
    );

    // Seed grades for demo students (idempotent) including Bob for report generation showcase
    await pool.query(
      `INSERT INTO grades (student_id, class_id, subject_id, exam_type_id, marks_obtained, max_marks, grade, exam_date, entered_by)
       SELECT
         u.id,
         c.id,
         s.id,
         et.id,
         g.marks_obtained,
         g.max_marks,
         CASE
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 90 THEN 'A+'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 80 THEN 'A'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 70 THEN 'B+'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 60 THEN 'B'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 50 THEN 'C'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 40 THEN 'D'
           ELSE 'F'
         END,
         g.exam_date,
         $1
       FROM (
         VALUES
           ('student1@demo.com', '10', 'A', 'MATH', 'Final Exam', 509.00, 550.00, CURRENT_DATE - INTERVAL '10 days'),
           ('student2@demo.com', '10', 'A', 'MATH', 'Final Exam', 486.00, 550.00, CURRENT_DATE - INTERVAL '10 days'),
           ('student2@demo.com', '10', 'A', 'SCI', 'Unit Test', 44.00, 50.00, CURRENT_DATE - INTERVAL '18 days'),
           ('student3@demo.com', '10', 'A', 'MATH', 'Unit Test', 39.00, 50.00, CURRENT_DATE - INTERVAL '20 days'),
           ('student6@demo.com', '10', 'B', 'SCI', 'Final Exam', 470.00, 550.00, CURRENT_DATE - INTERVAL '12 days')
       ) AS g(email, grade, section, subject_code, exam_type_name, marks_obtained, max_marks, exam_date)
       JOIN users u ON u.email = g.email
       JOIN classes c ON c.grade = g.grade AND c.section = g.section AND c.academic_year = '2024-2025'
       JOIN subjects s ON s.code = g.subject_code
       JOIN exam_types et ON LOWER(et.name) = LOWER(g.exam_type_name)
       WHERE NOT EXISTS (
         SELECT 1
         FROM grades existing
         WHERE existing.student_id = u.id
           AND existing.class_id = c.id
           AND existing.subject_id = s.id
           AND existing.exam_type_id = et.id
           AND existing.exam_date = g.exam_date::date
       )`,
      [teacherId]
    );

    // Add extra attendance records to produce realistic attendance analytics and early-warning signals.
    await pool.query(
      `INSERT INTO attendance (student_id, class_id, subject_id, date, status, marked_by)
       SELECT
         u.id,
         c.id,
         s.id,
         a.attendance_date::date,
         a.status,
         $1
       FROM (
         VALUES
           ('student1@demo.com', '10', 'A', 'MATH', CURRENT_DATE - INTERVAL '4 days', 'present'),
           ('student1@demo.com', '10', 'A', 'SCI', CURRENT_DATE - INTERVAL '3 days', 'present'),
           ('student1@demo.com', '10', 'A', 'ENG', CURRENT_DATE - INTERVAL '2 days', 'present'),
           ('student2@demo.com', '10', 'A', 'MATH', CURRENT_DATE - INTERVAL '4 days', 'present'),
           ('student2@demo.com', '10', 'A', 'SCI', CURRENT_DATE - INTERVAL '3 days', 'absent'),
           ('student2@demo.com', '10', 'A', 'ENG', CURRENT_DATE - INTERVAL '2 days', 'late'),
           ('student3@demo.com', '10', 'A', 'MATH', CURRENT_DATE - INTERVAL '4 days', 'absent'),
           ('student3@demo.com', '10', 'A', 'SCI', CURRENT_DATE - INTERVAL '3 days', 'present'),
           ('student3@demo.com', '10', 'A', 'ENG', CURRENT_DATE - INTERVAL '2 days', 'absent'),
           ('student4@demo.com', '10', 'A', 'MATH', CURRENT_DATE - INTERVAL '4 days', 'present'),
           ('student4@demo.com', '10', 'A', 'SCI', CURRENT_DATE - INTERVAL '3 days', 'present'),
           ('student4@demo.com', '10', 'A', 'ENG', CURRENT_DATE - INTERVAL '2 days', 'present'),
           ('student6@demo.com', '10', 'B', 'SCI', CURRENT_DATE - INTERVAL '4 days', 'present'),
           ('student6@demo.com', '10', 'B', 'MATH', CURRENT_DATE - INTERVAL '3 days', 'present'),
           ('student6@demo.com', '10', 'B', 'ENG', CURRENT_DATE - INTERVAL '2 days', 'absent')
       ) AS a(email, grade, section, subject_code, attendance_date, status)
       JOIN users u ON u.email = a.email
       JOIN classes c ON c.grade = a.grade AND c.section = a.section AND c.academic_year = '2024-2025'
       JOIN subjects s ON s.code = a.subject_code
       WHERE NOT EXISTS (
         SELECT 1
         FROM attendance existing
         WHERE existing.student_id = u.id
           AND existing.class_id = c.id
           AND existing.subject_id = s.id
           AND existing.date = a.attendance_date::date
       )`,
      [teacherId]
    );

    // Additional grade rows for class A and B to make class analytics meaningful.
    await pool.query(
      `INSERT INTO grades (student_id, class_id, subject_id, exam_type_id, marks_obtained, max_marks, grade, exam_date, entered_by)
       SELECT
         u.id,
         c.id,
         s.id,
         et.id,
         g.marks_obtained,
         g.max_marks,
         CASE
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 90 THEN 'A+'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 80 THEN 'A'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 70 THEN 'B+'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 60 THEN 'B'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 50 THEN 'C'
           WHEN (g.marks_obtained / NULLIF(g.max_marks, 0)) * 100 >= 40 THEN 'D'
           ELSE 'F'
         END,
         g.exam_date,
         $1
       FROM (
         VALUES
           ('student1@demo.com', '10', 'A', 'MATH', 'Mid Term', 92.00, 100.00, CURRENT_DATE - INTERVAL '35 days'),
           ('student1@demo.com', '10', 'A', 'SCI', 'Unit Test', 88.00, 100.00, CURRENT_DATE - INTERVAL '25 days'),
           ('student1@demo.com', '10', 'A', 'ENG', 'Quiz', 84.00, 100.00, CURRENT_DATE - INTERVAL '15 days'),
           ('student2@demo.com', '10', 'A', 'MATH', 'Mid Term', 61.00, 100.00, CURRENT_DATE - INTERVAL '35 days'),
           ('student2@demo.com', '10', 'A', 'SCI', 'Unit Test', 44.00, 100.00, CURRENT_DATE - INTERVAL '25 days'),
           ('student2@demo.com', '10', 'A', 'ENG', 'Quiz', 48.00, 100.00, CURRENT_DATE - INTERVAL '15 days'),
           ('student3@demo.com', '10', 'A', 'MATH', 'Mid Term', 38.00, 100.00, CURRENT_DATE - INTERVAL '35 days'),
           ('student3@demo.com', '10', 'A', 'SCI', 'Unit Test', 41.00, 100.00, CURRENT_DATE - INTERVAL '25 days'),
           ('student3@demo.com', '10', 'A', 'ENG', 'Quiz', 45.00, 100.00, CURRENT_DATE - INTERVAL '15 days'),
           ('student4@demo.com', '10', 'A', 'MATH', 'Mid Term', 74.00, 100.00, CURRENT_DATE - INTERVAL '35 days'),
           ('student4@demo.com', '10', 'A', 'SCI', 'Unit Test', 79.00, 100.00, CURRENT_DATE - INTERVAL '25 days'),
           ('student4@demo.com', '10', 'A', 'ENG', 'Quiz', 71.00, 100.00, CURRENT_DATE - INTERVAL '15 days'),
           ('student6@demo.com', '10', 'B', 'SCI', 'Mid Term', 90.00, 100.00, CURRENT_DATE - INTERVAL '35 days'),
           ('student6@demo.com', '10', 'B', 'MATH', 'Unit Test', 85.00, 100.00, CURRENT_DATE - INTERVAL '25 days'),
           ('student6@demo.com', '10', 'B', 'ENG', 'Quiz', 87.00, 100.00, CURRENT_DATE - INTERVAL '15 days')
       ) AS g(email, grade, section, subject_code, exam_type_name, marks_obtained, max_marks, exam_date)
       JOIN users u ON u.email = g.email
       JOIN classes c ON c.grade = g.grade AND c.section = g.section AND c.academic_year = '2024-2025'
       JOIN subjects s ON s.code = g.subject_code
       JOIN exam_types et ON LOWER(et.name) = LOWER(g.exam_type_name)
       WHERE NOT EXISTS (
         SELECT 1
         FROM grades existing
         WHERE existing.student_id = u.id
           AND existing.class_id = c.id
           AND existing.subject_id = s.id
           AND existing.exam_type_id = et.id
           AND existing.exam_date = g.exam_date::date
       )`,
      [teacherId]
    );

    // Seed showcase tests (scheduled, active, completed) without creating duplicates
    await pool.query(
      `INSERT INTO tests (class_id, subject_id, teacher_id, title, description, total_questions, test_type, status, start_time, end_time)
       SELECT c.id, s.id, $1, t.title, t.description, t.total_questions, 'manual', t.status, t.start_time, t.end_time
       FROM (
         VALUES
           ('10', 'A', 'MATH', 'Algebra Readiness Test', 'Quick diagnostic for Algebra fundamentals', 3, 'scheduled', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour'),
           ('10', 'A', 'MATH', 'Weekly Practice Quiz', 'Short active practice quiz for classwork', 3, 'active', NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '30 minutes'),
           ('10', 'A', 'SCI', 'Science Concepts Review', 'Completed formative check for revision', 2, 'completed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days')
       ) AS t(grade, section, subject_code, title, description, total_questions, status, start_time, end_time)
       JOIN classes c ON c.grade = t.grade AND c.section = t.section AND c.academic_year = '2024-2025'
       JOIN subjects s ON s.code = t.subject_code
       WHERE NOT EXISTS (
         SELECT 1 FROM tests existing
         WHERE existing.class_id = c.id
           AND existing.subject_id = s.id
           AND existing.title = t.title
       )`,
      [teacherId]
    );

    await pool.query(
      `INSERT INTO test_questions (test_id, question_number, question_text, question_type, correct_answer, points, difficulty)
       SELECT t.id, q.question_number, q.question_text, q.question_type, q.correct_answer, q.points, q.difficulty
       FROM tests t
       JOIN (
         VALUES
           ('Algebra Readiness Test', 1, 'Solve: 2x + 5 = 15', 'short_answer', '5', 2, 'easy'),
           ('Algebra Readiness Test', 2, 'Which expression is a polynomial?', 'mcq', '2', 1, 'easy'),
           ('Algebra Readiness Test', 3, 'The graph of y = x^2 opens upward. True or False?', 'true_false', 'true', 1, 'easy'),
           ('Weekly Practice Quiz', 1, 'What is 12 x 8?', 'mcq', '4', 1, 'easy'),
           ('Weekly Practice Quiz', 2, 'Simplify: 3x + 2x', 'short_answer', '5x', 1, 'easy'),
           ('Weekly Practice Quiz', 3, 'A linear equation has degree 1. True or False?', 'true_false', 'true', 1, 'easy'),
           ('Science Concepts Review', 1, 'Water boils at 100°C at standard pressure. True or False?', 'true_false', 'true', 1, 'easy'),
           ('Science Concepts Review', 2, 'Name the process by which plants make food.', 'short_answer', 'Photosynthesis', 2, 'easy')
       ) AS q(test_title, question_number, question_text, question_type, correct_answer, points, difficulty)
         ON t.title = q.test_title
       ON CONFLICT (test_id, question_number) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO question_options (question_id, option_number, option_text, is_correct)
       SELECT q.id, o.option_number, o.option_text, o.is_correct
       FROM test_questions q
       JOIN tests t ON q.test_id = t.id
       JOIN (
         VALUES
           ('Algebra Readiness Test', 2, 1, '1/x', false),
           ('Algebra Readiness Test', 2, 2, 'x^2 + 2x + 1', true),
           ('Algebra Readiness Test', 2, 3, 'sqrt(x)', false),
           ('Algebra Readiness Test', 2, 4, 'sin(x)', false),
           ('Weekly Practice Quiz', 1, 1, '84', false),
           ('Weekly Practice Quiz', 1, 2, '88', false),
           ('Weekly Practice Quiz', 1, 3, '92', false),
           ('Weekly Practice Quiz', 1, 4, '96', true)
       ) AS o(test_title, question_number, option_number, option_text, is_correct)
         ON t.title = o.test_title AND q.question_number = o.question_number
       ON CONFLICT (question_id, option_number) DO NOTHING`
    );

    // Seed one completed submission for Bob for showcase
    await pool.query(
      `INSERT INTO test_submissions (test_id, student_id, class_id, started_at, submitted_at, score, total_score, percentage, status)
       SELECT t.id, u.id, c.id, NOW() - INTERVAL '4 days 1 hour', NOW() - INTERVAL '4 days', 3, 3, 100, 'graded'
       FROM tests t
       JOIN classes c ON c.id = t.class_id
       JOIN users u ON u.email = 'student2@demo.com'
       WHERE t.title = 'Science Concepts Review'
       ON CONFLICT (test_id, student_id)
       DO UPDATE SET
         score = EXCLUDED.score,
         total_score = EXCLUDED.total_score,
         percentage = EXCLUDED.percentage,
         status = 'graded',
         submitted_at = EXCLUDED.submitted_at,
         updated_at = CURRENT_TIMESTAMP`
    );

    await pool.query(
      `INSERT INTO test_submissions (test_id, student_id, class_id, started_at, submitted_at, score, total_score, percentage, status)
       SELECT t.id, u.id, c.id, NOW() - INTERVAL '4 days 2 hours', NOW() - INTERVAL '4 days 1 hour', s.score, s.total_score, s.percentage, 'graded'
       FROM tests t
       JOIN classes c ON c.id = t.class_id
       CROSS JOIN (
         VALUES
           ('student1@demo.com', 2, 3, 66.67),
           ('student3@demo.com', 1, 3, 33.33),
           ('student4@demo.com', 3, 3, 100)
       ) AS s(email, score, total_score, percentage)
       JOIN users u ON u.email = s.email
       WHERE t.title = 'Science Concepts Review'
       ON CONFLICT (test_id, student_id)
       DO UPDATE SET
         score = EXCLUDED.score,
         total_score = EXCLUDED.total_score,
         percentage = EXCLUDED.percentage,
         status = 'graded',
         submitted_at = EXCLUDED.submitted_at,
         updated_at = CURRENT_TIMESTAMP`
    );

    console.log('Database seeded successfully!');
    console.log('\nDemo Login Credentials:');
    console.log('Teacher: teacher@demo.com / password123');
    console.log('Student: student1@demo.com / password123');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};
