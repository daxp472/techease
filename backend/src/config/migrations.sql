-- Syllabus and Curriculum Management Tables
-- This file extends the TeachEase schema with curriculum tracking capabilities

-- Syllabus/Curriculum Table
CREATE TABLE IF NOT EXISTS syllabuses (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  academic_year VARCHAR(20) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  total_topics INTEGER DEFAULT 0,
  topics_covered INTEGER DEFAULT 0,
  coverage_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, subject_id, academic_year)
);

-- Syllabus Topics Table
CREATE TABLE IF NOT EXISTS syllabus_topics (
  id SERIAL PRIMARY KEY,
  syllabus_id INTEGER REFERENCES syllabuses(id) ON DELETE CASCADE,
  topic_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'ongoing', 'covered')),
  covered_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(syllabus_id, topic_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_syllabuses_class ON syllabuses(class_id);
CREATE INDEX IF NOT EXISTS idx_syllabuses_subject ON syllabuses(subject_id);
CREATE INDEX IF NOT EXISTS idx_syllabuses_teacher ON syllabuses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_syllabus ON syllabus_topics(syllabus_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_status ON syllabus_topics(status);

-- Test and Quiz Management Tables
CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  duration_minutes INTEGER,
  total_questions INTEGER,
  passing_score DECIMAL(5,2),
  test_type VARCHAR(50) CHECK (test_type IN ('manual', 'ai_generated')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'archived')),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  show_answers BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Questions Table
CREATE TABLE IF NOT EXISTS test_questions (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) CHECK (question_type IN ('mcq', 'short_answer', 'long_answer', 'true_false')),
  correct_answer TEXT,
  points DECIMAL(5,2) DEFAULT 1,
  difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(test_id, question_number)
);

-- MCQ Options Table (for multiple choice questions)
CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES test_questions(id) ON DELETE CASCADE,
  option_number INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(question_id, option_number)
);

-- Test Submissions Table (Student test responses)
CREATE TABLE IF NOT EXISTS test_submissions (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  score DECIMAL(5,2),
  total_score DECIMAL(5,2),
  percentage DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(test_id, student_id)
);

-- Test Answers Table (Individual question responses)
CREATE TABLE IF NOT EXISTS test_answers (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES test_submissions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES test_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  points_awarded DECIMAL(5,2),
  is_correct BOOLEAN,
  graded_at TIMESTAMP,
  graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, question_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tests_class ON tests(class_id);
CREATE INDEX IF NOT EXISTS idx_tests_teacher ON tests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_test_questions_test ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_student ON test_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_status ON test_submissions(status);
CREATE INDEX IF NOT EXISTS idx_test_answers_submission ON test_answers(submission_id);
