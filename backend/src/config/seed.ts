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
         ('student5@demo.com', $1, 'Eve', 'Martinez', 'student', '123-456-7895')
       ON CONFLICT (email) DO NOTHING`,
      [hashedPassword]
    );

    await pool.query(
      `INSERT INTO classes (name, grade, section, academic_year, teacher_id, room_number)
       VALUES
         ('Mathematics A', '10', 'A', '2024-2025', 1, '101'),
         ('Science B', '10', 'B', '2024-2025', 1, '102')
       ON CONFLICT (grade, section, academic_year) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO enrollments (student_id, class_id, roll_number, status)
       VALUES
         (2, 1, '001', 'active'),
         (3, 1, '002', 'active'),
         (4, 1, '003', 'active'),
         (5, 1, '004', 'active'),
         (6, 1, '005', 'active')
       ON CONFLICT (student_id, class_id) DO NOTHING`
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

    // Seed one scheduled test with questions
    await pool.query(
      `INSERT INTO tests (class_id, subject_id, teacher_id, title, description, total_questions, test_type, status, start_time, end_time)
       VALUES
         (1, 1, 1, 'Algebra Readiness Test', 'Quick diagnostic for Algebra fundamentals', 3, 'manual', 'scheduled', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour')
       ON CONFLICT DO NOTHING`
    );

    await pool.query(
      `INSERT INTO test_questions (test_id, question_number, question_text, question_type, correct_answer, points, difficulty)
       SELECT t.id, q.question_number, q.question_text, q.question_type, q.correct_answer, q.points, q.difficulty
       FROM tests t
       JOIN (
         VALUES
           ('Algebra Readiness Test', 1, 'Solve: 2x + 5 = 15', 'short_answer', '5', 2, 'easy'),
           ('Algebra Readiness Test', 2, 'Which expression is a polynomial?', 'mcq', '2', 1, 'easy'),
           ('Algebra Readiness Test', 3, 'The graph of y = x^2 opens upward. True or False?', 'true_false', 'true', 1, 'easy')
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
           ('Algebra Readiness Test', 2, 4, 'sin(x)', false)
       ) AS o(test_title, question_number, option_number, option_text, is_correct)
         ON t.title = o.test_title AND q.question_number = o.question_number
       ON CONFLICT (question_id, option_number) DO NOTHING`
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
