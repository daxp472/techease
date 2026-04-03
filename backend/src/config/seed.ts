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

    console.log('Database seeded successfully!');
    console.log('\nDemo Login Credentials:');
    console.log('Teacher: teacher@demo.com / password123');
    console.log('Student: student1@demo.com / password123');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};
