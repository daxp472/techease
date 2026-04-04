import { Request, Response } from 'express';
import pool from '../config/database';
import { extractTextFromPDF, generateQuizFromContent } from '../services/geminiService';

const normalizeAnswerValue = (answer: any): string => {
  if (answer === null || answer === undefined) {
    return '';
  }
  return String(answer).trim();
};

const serializeStudentAnswer = (answer: any): string => {
  if (Array.isArray(answer)) {
    const normalized = Array.from(
      new Set(
        answer
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      )
    );
    return JSON.stringify(normalized);
  }

  return normalizeAnswerValue(answer);
};

const parseStudentAnswerIds = (answer: any): number[] => {
  if (Array.isArray(answer)) {
    return Array.from(
      new Set(
        answer
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      )
    );
  }

  const normalized = normalizeAnswerValue(answer);
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value))
          )
        );
      }
    } catch {
      // Fall through to legacy parsing formats.
    }
  }

  if (normalized.includes(',')) {
    return Array.from(
      new Set(
        normalized
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value))
      )
    );
  }

  const single = Number(normalized);
  return Number.isFinite(single) ? [single] : [];
};

const areNumberSetsEqual = (left: number[], right: number[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);

  return leftSorted.every((value, index) => value === rightSorted[index]);
};

const toTime = (value: any): number | null => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const isStudentWindowOpen = (test: any): boolean => {
  const now = Date.now();
  const start = toTime(test.start_time);
  const end = toTime(test.end_time);

  if (test.status === 'draft' || test.status === 'archived') {
    return false;
  }
  if (start && now < start) {
    return false;
  }
  if (end && now > end) {
    return false;
  }
  if (test.status === 'completed') {
    return false;
  }
  return true;
};

const hasTestStarted = (test: any): boolean => {
  const start = toTime(test.start_time);
  return Boolean(start && Date.now() >= start);
};

// Create new test
export const createTest = async (req: Request, res: Response) => {
  try {
    const {
      classId,
      subjectId,
      title,
      description,
      instructions,
      durationMinutes,
      passingScore,
      testType,
      totalQuestions,
      startTime,
      endTime,
      showAnswers,
      shuffleQuestions
    } = req.body;
    const teacherId = (req as any).user?.id;

    if (!classId || !subjectId || !title || !teacherId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO tests (class_id, subject_id, teacher_id, title, description, instructions, duration_minutes, total_questions, passing_score, test_type, status, start_time, end_time, show_answers, shuffle_questions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        classId,
        subjectId,
        teacherId,
        title,
        description || null,
        instructions || null,
        durationMinutes || null,
        totalQuestions || 0,
        passingScore || 0,
        testType || 'manual',
        'draft',
        startTime || null,
        endTime || null,
        showAnswers ?? false,
        shuffleQuestions ?? true
      ]
    );

    res.status(201).json({
      message: 'Test created successfully',
      test: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(500).json({ message: 'Error creating test' });
  }
};

// Add question to test
export const addQuestion = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const {
      questionNumber,
      questionText,
      questionType,
      correctAnswer,
      points,
      difficulty,
      options
    } = req.body;

    const questionResult = await pool.query(
      `INSERT INTO test_questions (test_id, question_number, question_text, question_type, correct_answer, points, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        parseInt(testId),
        questionNumber,
        questionText,
        questionType,
        correctAnswer || null,
        points || 1,
        difficulty || 'medium'
      ]
    );

    const questionId = questionResult.rows[0].id;

    // Add MCQ options if provided
    if (questionType === 'mcq' && Array.isArray(options)) {
      for (const option of options) {
        await pool.query(
          `INSERT INTO question_options (question_id, option_number, option_text, is_correct)
           VALUES ($1, $2, $3, $4)`,
          [questionId, option.optionNumber, option.optionText, option.isCorrect || false]
        );
      }
    }

    res.status(201).json({
      message: 'Question added successfully',
      question: questionResult.rows[0]
    });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ message: 'Error adding question' });
  }
};

export const replaceTestQuestions = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { questions } = req.body;
    const teacherId = (req as any).user?.id;
    const role = (req as any).user?.role;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Questions array is required' });
    }

    const testResult = await pool.query(
      `SELECT id, teacher_id, status, start_time
       FROM tests
       WHERE id = $1`,
      [parseInt(testId)]
    );

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    if (role !== 'admin' && Number(testResult.rows[0].teacher_id) !== Number(teacherId)) {
      return res.status(403).json({ message: 'Not allowed to edit this test' });
    }

    if (hasTestStarted(testResult.rows[0]) || testResult.rows[0].status === 'active' || testResult.rows[0].status === 'completed') {
      return res.status(409).json({ message: 'Test can no longer be edited after start time' });
    }

    await pool.query('BEGIN');

    await pool.query(
      `DELETE FROM test_questions
       WHERE test_id = $1`,
      [parseInt(testId)]
    );

    let questionNumber = 1;
    for (const question of questions) {
      const questionText = String(question?.questionText || '').trim();
      if (!questionText) {
        continue;
      }

      const questionType = question.questionType || 'mcq';
      const points = Number(question.points || 1);
      const difficulty = question.difficulty || 'medium';

      const questionResult = await pool.query(
        `INSERT INTO test_questions (test_id, question_number, question_text, question_type, correct_answer, points, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          parseInt(testId),
          questionNumber,
          questionText,
          questionType,
          question.correctAnswer || null,
          points,
          difficulty
        ]
      );

      const newQuestionId = questionResult.rows[0].id;
      if (questionType === 'mcq' && Array.isArray(question.options)) {
        const options = question.options
          .map((option: any, index: number) => ({
            optionNumber: Number(option.optionNumber || index + 1),
            optionText: String(option.optionText || '').trim(),
            isCorrect: Boolean(option.isCorrect)
          }))
          .filter((option: any) => option.optionText);

        for (const option of options) {
          await pool.query(
            `INSERT INTO question_options (question_id, option_number, option_text, is_correct)
             VALUES ($1, $2, $3, $4)`,
            [newQuestionId, option.optionNumber, option.optionText, option.isCorrect]
          );
        }
      }

      questionNumber += 1;
    }

    await pool.query(
      `UPDATE tests
       SET total_questions = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [questionNumber - 1, parseInt(testId)]
    );

    await pool.query('COMMIT');

    return res.json({
      message: 'Test questions updated successfully',
      totalQuestions: questionNumber - 1
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error replacing test questions:', error);
    return res.status(500).json({ message: 'Error updating test questions' });
  }
};

export const updateTestSettings = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const teacherId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const {
      title,
      description,
      instructions,
      durationMinutes,
      passingScore,
      startTime,
      endTime
    } = req.body;

    const testResult = await pool.query(
      `SELECT id, teacher_id, status, start_time
       FROM tests
       WHERE id = $1`,
      [parseInt(testId)]
    );

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const existingTest = testResult.rows[0];
    if (role !== 'admin' && Number(existingTest.teacher_id) !== Number(teacherId)) {
      return res.status(403).json({ message: 'Not allowed to edit this test' });
    }

    if (hasTestStarted(existingTest) || existingTest.status === 'active' || existingTest.status === 'completed') {
      return res.status(409).json({ message: 'Test settings cannot be edited after start time' });
    }

    const result = await pool.query(
      `UPDATE tests
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           instructions = COALESCE($3, instructions),
           duration_minutes = COALESCE($4, duration_minutes),
           passing_score = COALESCE($5, passing_score),
           start_time = COALESCE($6, start_time),
           end_time = COALESCE($7, end_time),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        title ?? null,
        description ?? null,
        instructions ?? null,
        durationMinutes ?? null,
        passingScore ?? null,
        startTime ?? null,
        endTime ?? null,
        parseInt(testId)
      ]
    );

    return res.json({
      message: 'Test settings updated successfully',
      test: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating test settings:', error);
    return res.status(500).json({ message: 'Error updating test settings' });
  }
};

// Get test with all questions
export const getTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;

    const testResult = await pool.query(
      `SELECT t.*,
              c.name as "className",
              c.grade as "classGrade",
              c.section as "classSection",
              s.name as "subjectName",
              s.code as "subjectCode",
              u.first_name as "teacherFirstName",
              u.last_name as "teacherLastName"
       FROM tests t
       LEFT JOIN classes c ON t.class_id = c.id
       LEFT JOIN subjects s ON t.subject_id = s.id
       LEFT JOIN users u ON t.teacher_id = u.id
       WHERE t.id = $1`,
      [parseInt(testId)]
    );

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const test = testResult.rows[0];

    if (role === 'student') {
      const enrollmentResult = await pool.query(
        `SELECT id
         FROM enrollments
         WHERE class_id = $1 AND student_id = $2 AND status = 'active'
         LIMIT 1`,
        [test.class_id, userId]
      );

      if (enrollmentResult.rows.length === 0) {
        return res.status(403).json({ message: 'You are not enrolled in this class test.' });
      }

      if (!isStudentWindowOpen(test)) {
        const now = Date.now();
        const start = toTime(test.start_time);
        const end = toTime(test.end_time);

        if (start && now < start) {
          return res.status(403).json({ message: 'This test has not started yet.' });
        }
        if (end && now > end) {
          return res.status(403).json({ message: 'Test window has ended. View your score in results.' });
        }
        return res.status(403).json({ message: 'This test is not currently available.' });
      }
    }

    const questionsResult = await pool.query(
      `SELECT tq.id,
              tq.test_id as "testId",
              tq.question_number as "questionNumber",
              tq.question_text as "questionText",
              tq.question_type as "questionType",
              tq.correct_answer as "correctAnswer",
              tq.points,
              tq.difficulty,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', qo.id,
                    'optionNumber', qo.option_number,
                    'optionText', qo.option_text,
                    'isCorrect', qo.is_correct
                  )
                  ORDER BY qo.option_number
                ) FILTER (WHERE qo.id IS NOT NULL),
                '[]'::json
              ) as options
       FROM test_questions tq
       LEFT JOIN question_options qo ON tq.id = qo.question_id
       WHERE tq.test_id = $1
       GROUP BY tq.id
       ORDER BY tq.question_number`,
      [parseInt(testId)]
    );

    const questions = questionsResult.rows || [];

    test.questions = questions.map((question: any) => {
      if (role === 'student') {
        const filteredOptions = Array.isArray(question.options)
          ? question.options.filter((option: any) => option && option.id)
          : [];
        const allowsMultiple = filteredOptions.filter((option: any) => Boolean(option?.isCorrect)).length > 1;

        return {
          ...question,
          allowsMultiple,
          correctAnswer: undefined,
          correct_answer: undefined,
          options: filteredOptions.map((option: any) => ({
            ...option,
            isCorrect: undefined
          }))
        };
      }

      return question;
    });

    res.json({ test });
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ message: 'Error fetching test' });
  }
};

// Publish/Schedule test
export const publishTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { status, startTime, endTime } = req.body;

    if (!['scheduled', 'active'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const currentResult = await pool.query(
      `SELECT id, status, start_time
       FROM tests
       WHERE id = $1`,
      [parseInt(testId)]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const startTimeValue = startTime || null;
    const endTimeValue = endTime || null;
    let nextStatus = status;

    // If the selected schedule time has already arrived, activate immediately instead of failing.
    if (status === 'scheduled' && startTimeValue && new Date(startTimeValue).getTime() <= Date.now()) {
      nextStatus = 'active';
    }

    if ((currentResult.rows[0].status === 'active' || hasTestStarted(currentResult.rows[0])) && nextStatus === 'scheduled') {
      return res.status(409).json({ message: 'Cannot move an active/started test back to scheduled' });
    }

    const result = await pool.query(
      `UPDATE tests 
       SET status = $1, start_time = $2, end_time = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [nextStatus, startTimeValue, endTimeValue, parseInt(testId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({
      message: `Test ${nextStatus} successfully`,
      test: result.rows[0]
    });
  } catch (error) {
    console.error('Error publishing test:', error);
    res.status(500).json({ message: 'Error publishing test' });
  }
};

// Get tests for a class (student view)
export const getClassTests = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    let queryText = `
      SELECT t.*, s.name as subject_name
      FROM tests t
      JOIN subjects s ON t.subject_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userRole === 'student') {
      params.push(userId);
      const studentIdParam = params.length;
      queryText = `
      SELECT t.*, s.name as subject_name,
             ts.status as submission_status,
             ts.score as submission_score,
             ts.total_score as submission_total_score,
             ts.percentage as submission_percentage
      FROM tests t
      JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN test_submissions ts ON ts.test_id = t.id AND ts.student_id = $${studentIdParam}
      WHERE 1=1
      `;
      queryText += `
        AND t.class_id IN (
          SELECT e.class_id
          FROM enrollments e
          WHERE e.student_id = $${studentIdParam} AND e.status = 'active'
        )
        AND (
          (
            t.status IN ('active', 'scheduled')
            AND (t.start_time IS NULL OR t.start_time <= CURRENT_TIMESTAMP)
            AND (t.end_time IS NULL OR t.end_time >= CURRENT_TIMESTAMP)
          )
          OR t.status = 'completed'
          OR (t.end_time IS NOT NULL AND t.end_time < CURRENT_TIMESTAMP)
        )
      `;
      if (classId) {
        params.push(parseInt(classId as string));
        queryText += ` AND t.class_id = $${params.length}`;
      }
    } else if (classId) {
      params.push(parseInt(classId as string));
      queryText += ` AND t.class_id = $${params.length}`;
    } else if (userRole === 'teacher') {
      params.push(userId);
      queryText += ` AND t.teacher_id = $${params.length}`;
      queryText += ` AND t.status IN ('draft', 'scheduled', 'active', 'completed', 'archived')`;
    } else if (userRole === 'admin') {
      queryText += ` AND t.status IN ('draft', 'scheduled', 'active', 'completed', 'archived')`;
    } else {
      queryText += ` AND t.status IN ('scheduled', 'active', 'completed')`;
    }

    queryText += `
      ORDER BY
        CASE t.status
          WHEN 'active' THEN 0
          WHEN 'scheduled' THEN 1
          WHEN 'completed' THEN 2
          ELSE 3
        END,
        t.start_time DESC NULLS LAST,
        t.created_at DESC
    `;

    const result = await pool.query(queryText, params);

    res.json({ tests: result.rows });
  } catch (error) {
    console.error('Error fetching class tests:', error);
    res.status(500).json({ message: 'Error fetching tests' });
  }
};

// Student submits test answers
export const submitTestAnswers = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { answers } = req.body;
    const studentId = (req as any).user?.id;

    if (!studentId || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await pool.query('BEGIN');

    const testResult = await pool.query(
      `SELECT t.id, t.class_id, t.status, t.start_time, t.end_time
       FROM tests t
       JOIN enrollments e ON e.class_id = t.class_id AND e.student_id = $2 AND e.status = 'active'
       WHERE t.id = $1`,
      [parseInt(testId), studentId]
    );

    if (testResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Test not found for this student' });
    }

    if (!isStudentWindowOpen(testResult.rows[0])) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ message: 'This test is not available for submission right now.' });
    }

    const existingSubmission = await pool.query(
      `SELECT id, status
       FROM test_submissions
       WHERE test_id = $1 AND student_id = $2
       LIMIT 1`,
      [parseInt(testId), studentId]
    );

    if (existingSubmission.rows.length > 0 && existingSubmission.rows[0].status === 'graded') {
      await pool.query('ROLLBACK');
      return res.status(409).json({ message: 'Test already submitted and graded' });
    }

    const submissionResult = await pool.query(
      `INSERT INTO test_submissions (test_id, student_id, class_id, started_at, submitted_at, status)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'submitted')
       ON CONFLICT (test_id, student_id)
       DO UPDATE SET
         status = 'submitted',
         submitted_at = CURRENT_TIMESTAMP,
         started_at = COALESCE(test_submissions.started_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [parseInt(testId), studentId, testResult.rows[0].class_id]
    );

    if (submissionResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Test not found' });
    }

    const submissionId = submissionResult.rows[0].id;

    await pool.query('DELETE FROM test_answers WHERE submission_id = $1', [submissionId]);

    const questionsResult = await pool.query(
      `SELECT id, question_type, correct_answer, points
       FROM test_questions
       WHERE test_id = $1`,
      [parseInt(testId)]
    );

    const testQuestions = questionsResult.rows || [];
    const questionMap = new Map<number, any>(
      testQuestions.map((question: any) => [Number(question.id), question])
    );

    const answerMap = new Map<number, any>();
    for (const answer of answers) {
      const questionId = Number(answer?.questionId);
      if (!Number.isFinite(questionId)) {
        continue;
      }
      answerMap.set(questionId, answer);
    }

    if (answerMap.size === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'No valid answers were provided' });
    }

    // Auto-grade MCQs and calculate score
    let totalScore = 0;
    let maxScore = 0;

    for (const question of testQuestions) {
      const questionId = Number(question.id);
      const answer = answerMap.get(questionId);
      const questionPoints = Number(question.points || 0);
      maxScore += questionPoints;

      let isCorrect = false;
      let pointsAwarded = 0;
      const studentAnswer = serializeStudentAnswer(answer?.answer);

      if (question.question_type === 'mcq' && studentAnswer) {
        const selectedAnswers = parseStudentAnswerIds(answer?.answer);
        if (selectedAnswers.length > 0) {
          const correctOptionsResult = await pool.query(
            `SELECT id, option_number
             FROM question_options
             WHERE question_id = $1 AND is_correct = true`,
            [questionId]
          );

          const correctByOptionId = correctOptionsResult.rows
            .map((option: any) => Number(option.id))
            .filter((value: number) => Number.isFinite(value));
          const correctByOptionNumber = correctOptionsResult.rows
            .map((option: any) => Number(option.option_number))
            .filter((value: number) => Number.isFinite(value));

          const idBasedMatch = areNumberSetsEqual(selectedAnswers, correctByOptionId);
          const numberBasedMatch = areNumberSetsEqual(selectedAnswers, correctByOptionNumber);

          if (idBasedMatch || numberBasedMatch) {
            isCorrect = true;
            pointsAwarded = questionPoints;
            totalScore += pointsAwarded;
          }
        }
      } else if (question.question_type === 'true_false' && studentAnswer) {
        isCorrect = studentAnswer.toLowerCase() === normalizeAnswerValue(question.correct_answer).toLowerCase();
        if (isCorrect) {
          pointsAwarded = questionPoints;
          totalScore += pointsAwarded;
        }
      }
      // Short answer and long answer require manual grading

      // Save answer
      await pool.query(
        `INSERT INTO test_answers (submission_id, question_id, student_answer, points_awarded, is_correct)
         VALUES ($1, $2, $3, $4, $5)`,
        [submissionId, questionId, studentAnswer, pointsAwarded, isCorrect]
      );
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Update submission with calculated score
    await pool.query(
      `UPDATE test_submissions 
       SET score = $1, total_score = $2, percentage = $3, status = $4
       WHERE id = $5`,
      [totalScore, maxScore, percentage, 'graded', submissionId]
    );

    await pool.query('COMMIT');

    res.json({
      message: 'Test submitted successfully',
      submission: {
        id: submissionId,
        score: totalScore,
        totalScore: maxScore,
        percentage: percentage
      }
    });
  } catch (error) {
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed after submit error:', rollbackError);
    }
    console.error('Error submitting test:', error);
    res.status(500).json({ message: 'Error submitting test' });
  }
};

export const saveTestProgress = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const { answers } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const requestedStudentId = Number(req.body?.studentId || 0);
    const studentId = userRole === 'admin' && requestedStudentId > 0 ? requestedStudentId : userId;

    if (!studentId || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (userRole === 'admin' && !requestedStudentId) {
      return res.status(400).json({ message: 'studentId is required for admin progress operations' });
    }

    await pool.query('BEGIN');

    const testResult = await pool.query(
      `SELECT t.id, t.class_id, t.status, t.start_time, t.end_time
       FROM tests t
       JOIN enrollments e ON e.class_id = t.class_id AND e.student_id = $2 AND e.status = 'active'
       WHERE t.id = $1`,
      [parseInt(testId), studentId]
    );

    if (testResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Test not found for this student' });
    }

    if (userRole !== 'admin' && !isStudentWindowOpen(testResult.rows[0])) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ message: 'This test is not available for progress save right now.' });
    }

    const existingSubmission = await pool.query(
      `SELECT id, status
       FROM test_submissions
       WHERE test_id = $1 AND student_id = $2
       LIMIT 1`,
      [parseInt(testId), studentId]
    );

    if (existingSubmission.rows.length > 0 && existingSubmission.rows[0].status === 'graded') {
      await pool.query('ROLLBACK');
      return res.status(409).json({ message: 'Test already graded. Progress cannot be updated.' });
    }

    const submissionResult = await pool.query(
      `INSERT INTO test_submissions (test_id, student_id, class_id, started_at, status)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'in_progress')
       ON CONFLICT (test_id, student_id)
       DO UPDATE SET
         status = CASE
           WHEN test_submissions.status = 'graded' THEN test_submissions.status
           ELSE 'in_progress'
         END,
         started_at = COALESCE(test_submissions.started_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [parseInt(testId), studentId, testResult.rows[0].class_id]
    );

    const submissionId = submissionResult.rows[0].id;

    await pool.query('DELETE FROM test_answers WHERE submission_id = $1', [submissionId]);

    for (const answer of answers) {
      if (!answer?.questionId) {
        continue;
      }

      await pool.query(
        `INSERT INTO test_answers (submission_id, question_id, student_answer)
         VALUES ($1, $2, $3)
         ON CONFLICT (submission_id, question_id)
         DO UPDATE SET
           student_answer = EXCLUDED.student_answer,
           updated_at = CURRENT_TIMESTAMP`,
        [submissionId, Number(answer.questionId), serializeStudentAnswer(answer.answer)]
      );
    }

    await pool.query('COMMIT');

    return res.json({
      message: 'Progress saved successfully',
      submissionId
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error saving test progress:', error);
    return res.status(500).json({ message: 'Error saving test progress' });
  }
};

export const getStudentTestProgress = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const requestedStudentId = Number(req.query?.studentId || 0);
    const studentId = userRole === 'admin' && requestedStudentId > 0 ? requestedStudentId : userId;

    if (userRole === 'admin' && !requestedStudentId) {
      return res.status(400).json({ message: 'studentId query parameter is required for admin progress lookups' });
    }

    const testResult = await pool.query(
      `SELECT t.id, t.class_id, t.status, t.start_time, t.end_time
       FROM tests t
       JOIN enrollments e ON e.class_id = t.class_id AND e.student_id = $2 AND e.status = 'active'
       WHERE t.id = $1`,
      [parseInt(testId), studentId]
    );

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found for this student' });
    }

    if (userRole !== 'admin' && !isStudentWindowOpen(testResult.rows[0])) {
      return res.status(403).json({ message: 'This test is not currently available.' });
    }

    const submissionResult = await pool.query(
      `SELECT id, status
       FROM test_submissions
       WHERE test_id = $1 AND student_id = $2
       LIMIT 1`,
      [parseInt(testId), studentId]
    );

    if (submissionResult.rows.length === 0) {
      return res.json({ answers: [], status: 'not_started' });
    }

    const submission = submissionResult.rows[0];
    const answersResult = await pool.query(
      `SELECT question_id as "questionId", student_answer as "answer"
       FROM test_answers
       WHERE submission_id = $1`,
      [submission.id]
    );

    return res.json({
      status: submission.status,
      answers: answersResult.rows
    });
  } catch (error) {
    console.error('Error loading test progress:', error);
    return res.status(500).json({ message: 'Error loading test progress' });
  }
};

export const reportQuestionIssue = async (req: Request, res: Response) => {
  try {
    const { testId, questionId } = req.params;
    const { issueType, comment } = req.body;
    const studentId = (req as any).user?.id;
    const role = (req as any).user?.role;

    if (role !== 'student') {
      return res.status(403).json({ message: 'Only students can report question issues' });
    }

    const normalizedIssueType = String(issueType || '').trim();
    const allowedIssueTypes = new Set(['wrong_question', 'incorrect_answer', 'option_issue', 'unclear', 'typo', 'other']);
    if (!allowedIssueTypes.has(normalizedIssueType)) {
      return res.status(400).json({ message: 'Invalid issue type' });
    }

    const testAndQuestionResult = await pool.query(
      `SELECT t.id, t.class_id, t.status, t.start_time, t.end_time,
              tq.id as question_id
       FROM tests t
       JOIN test_questions tq ON tq.test_id = t.id
       JOIN enrollments e ON e.class_id = t.class_id AND e.student_id = $3 AND e.status = 'active'
       WHERE t.id = $1 AND tq.id = $2
       LIMIT 1`,
      [Number(testId), Number(questionId), studentId]
    );

    if (testAndQuestionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found for this student test' });
    }

    if (!isStudentWindowOpen(testAndQuestionResult.rows[0])) {
      return res.status(403).json({ message: 'Question reporting is available only during active test window' });
    }

    const submissionResult = await pool.query(
      `SELECT id
       FROM test_submissions
       WHERE test_id = $1 AND student_id = $2
       ORDER BY id DESC
       LIMIT 1`,
      [Number(testId), studentId]
    );

    const submissionId = submissionResult.rows[0]?.id ? Number(submissionResult.rows[0].id) : null;

    const existingOpenReport = await pool.query(
      `SELECT id
       FROM test_question_reports
       WHERE test_id = $1 AND question_id = $2 AND student_id = $3 AND status = 'open'
       ORDER BY id DESC
       LIMIT 1`,
      [Number(testId), Number(questionId), studentId]
    );

    if (existingOpenReport.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE test_question_reports
         SET issue_type = $1,
             comment = $2,
             submission_id = COALESCE($3, submission_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [normalizedIssueType, String(comment || '').trim() || null, submissionId, Number(existingOpenReport.rows[0].id)]
      );

      return res.json({
        message: 'Question issue updated successfully',
        report: updated.rows[0]
      });
    }

    const created = await pool.query(
      `INSERT INTO test_question_reports (test_id, question_id, student_id, submission_id, issue_type, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        Number(testId),
        Number(questionId),
        studentId,
        submissionId,
        normalizedIssueType,
        String(comment || '').trim() || null
      ]
    );

    return res.status(201).json({
      message: 'Question issue reported successfully',
      report: created.rows[0]
    });
  } catch (error) {
    console.error('Error reporting question issue:', error);
    return res.status(500).json({ message: 'Error reporting question issue' });
  }
};

export const getTestQuestionReports = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;

    const testAccessResult = await pool.query(
      `SELECT id, teacher_id
       FROM tests
       WHERE id = $1
       LIMIT 1`,
      [Number(testId)]
    );

    if (testAccessResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    if (role !== 'admin' && Number(testAccessResult.rows[0].teacher_id) !== Number(userId)) {
      return res.status(403).json({ message: 'Not allowed to view reports for this test' });
    }

    const reportsResult = await pool.query(
      `SELECT r.id,
              r.test_id as "testId",
              r.question_id as "questionId",
              r.student_id as "studentId",
              r.issue_type as "issueType",
              r.comment,
              r.status,
              r.resolution_note as "resolutionNote",
              r.resolved_by as "resolvedBy",
              r.resolved_at as "resolvedAt",
              r.created_at as "createdAt",
              r.updated_at as "updatedAt",
              tq.question_number as "questionNumber",
              tq.question_text as "questionText",
              u.first_name as "studentFirstName",
              u.last_name as "studentLastName",
              u.email as "studentEmail"
       FROM test_question_reports r
       JOIN test_questions tq ON tq.id = r.question_id
       JOIN users u ON u.id = r.student_id
       WHERE r.test_id = $1
       ORDER BY
         CASE r.status
           WHEN 'open' THEN 0
           WHEN 'resolved' THEN 1
           ELSE 2
         END,
         r.created_at DESC`,
      [Number(testId)]
    );

    return res.json({ reports: reportsResult.rows });
  } catch (error) {
    console.error('Error fetching test question reports:', error);
    return res.status(500).json({ message: 'Error fetching question reports' });
  }
};

export const updateQuestionReportStatus = async (req: Request, res: Response) => {
  try {
    const { testId, reportId } = req.params;
    const { status, resolutionNote } = req.body;
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;

    const normalizedStatus = String(status || '').trim();
    if (!['open', 'resolved', 'ignored'].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid report status' });
    }

    const testAccessResult = await pool.query(
      `SELECT id, teacher_id
       FROM tests
       WHERE id = $1
       LIMIT 1`,
      [Number(testId)]
    );

    if (testAccessResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    if (role !== 'admin' && Number(testAccessResult.rows[0].teacher_id) !== Number(userId)) {
      return res.status(403).json({ message: 'Not allowed to update reports for this test' });
    }

    const updated = await pool.query(
      `UPDATE test_question_reports
       SET status = $1,
           resolution_note = $2,
           resolved_by = CASE WHEN $1 IN ('resolved', 'ignored') THEN $3 ELSE NULL END,
           resolved_at = CASE WHEN $1 IN ('resolved', 'ignored') THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND test_id = $5
       RETURNING *`,
      [
        normalizedStatus,
        String(resolutionNote || '').trim() || null,
        userId,
        Number(reportId),
        Number(testId)
      ]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Report not found for this test' });
    }

    return res.json({
      message: 'Report status updated successfully',
      report: updated.rows[0]
    });
  } catch (error) {
    console.error('Error updating question report status:', error);
    return res.status(500).json({ message: 'Error updating report status' });
  }
};

// Get student test results
export const getStudentTestResults = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    const testResult = await pool.query(
      `SELECT t.id, t.title, t.description, t.instructions, t.total_questions, t.duration_minutes, t.passing_score,
              t.status, t.start_time, t.end_time, t.test_type,
              c.name as "className", c.grade as "classGrade", c.section as "classSection",
              s.name as "subjectName", s.code as "subjectCode",
              u.first_name as "teacherFirstName", u.last_name as "teacherLastName"
       FROM tests t
       LEFT JOIN classes c ON t.class_id = c.id
       LEFT JOIN subjects s ON t.subject_id = s.id
       LEFT JOIN users u ON t.teacher_id = u.id
       WHERE t.id = $1`,
      [parseInt(testId)]
    );

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const test = testResult.rows[0];

    if (userRole === 'student') {
      const result = await pool.query(
        `SELECT ts.*, t.title, t.show_answers, s.name as subject_name
         FROM test_submissions ts
         JOIN tests t ON ts.test_id = t.id
         JOIN subjects s ON t.subject_id = s.id
         WHERE ts.test_id = $1 AND ts.student_id = $2`,
        [parseInt(testId), userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Test submission not found' });
      }

      if (result.rows[0].status !== 'graded') {
        return res.status(403).json({ message: 'Result is not available yet.' });
      }

      const answersResult = await pool.query(
        `SELECT ta.question_id as "questionId", ta.student_answer as "studentAnswer", ta.points_awarded as "pointsAwarded",
                ta.is_correct as "isCorrect", tq.question_number as "questionNumber", tq.question_text as "questionText",
                tq.question_type as "questionType", tq.points as "maxPoints"
         FROM test_answers ta
         JOIN test_questions tq ON ta.question_id = tq.id
         WHERE ta.submission_id = $1
         ORDER BY tq.question_number`,
        [result.rows[0].id]
      );

      return res.json({
        test,
        submission: {
          ...result.rows[0],
          answers: answersResult.rows
        }
      });
    }

    const submissionsResult = await pool.query(
      `SELECT ts.id,
              ts.student_id as "studentId",
              ts.score,
              ts.total_score as "totalScore",
              ts.percentage,
              ts.status,
              ts.started_at as "startedAt",
              ts.submitted_at as "submittedAt",
              u.first_name as "firstName",
              u.last_name as "lastName",
              u.email,
              e.roll_number as "rollNumber"
       FROM test_submissions ts
       JOIN users u ON ts.student_id = u.id
       LEFT JOIN enrollments e ON e.student_id = ts.student_id AND e.class_id = ts.class_id
       WHERE ts.test_id = $1
       ORDER BY ts.percentage DESC NULLS LAST, u.first_name, u.last_name`,
      [parseInt(testId)]
    );

    const questionResult = await pool.query(
      `SELECT tq.id,
              tq.question_number as "questionNumber",
              tq.question_text as "questionText",
              tq.question_type as "questionType",
              tq.points as "points"
       FROM test_questions tq
       WHERE tq.test_id = $1
       ORDER BY tq.question_number`,
      [parseInt(testId)]
    );

    const answerResult = await pool.query(
      `SELECT ta.submission_id as "submissionId",
              ta.question_id as "questionId",
              ta.student_answer as "studentAnswer",
              ta.points_awarded as "pointsAwarded",
              ta.is_correct as "isCorrect",
              ta.notes,
              tq.question_number as "questionNumber",
              tq.question_text as "questionText",
              tq.question_type as "questionType",
              tq.points as "maxPoints"
       FROM test_answers ta
       JOIN test_questions tq ON ta.question_id = tq.id
       WHERE tq.test_id = $1
       ORDER BY tq.question_number`,
      [parseInt(testId)]
    );

    const answerMap = new Map<number, any[]>();
    for (const answer of answerResult.rows) {
      const current = answerMap.get(answer.submissionId) || [];
      current.push(answer);
      answerMap.set(answer.submissionId, current);
    }

    const submissions = submissionsResult.rows.map((submission) => {
      const answers = answerMap.get(submission.id) || [];
      const failedQuestions = answers
        .filter((answer) => !answer.isCorrect || Number(answer.pointsAwarded || 0) === 0)
        .map((answer) => ({
          questionNumber: answer.questionNumber,
          questionText: answer.questionText,
          questionType: answer.questionType,
          studentAnswer: answer.studentAnswer,
          pointsAwarded: answer.pointsAwarded,
          maxPoints: answer.maxPoints,
          isCorrect: answer.isCorrect
        }));

      return {
        ...submission,
        answers,
        failedQuestions
      };
    });

    const gradedSubmissions = submissions.filter((submission) => submission.status === 'graded');
    const averagePercentage = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, submission) => sum + Number(submission.percentage || 0), 0) / gradedSubmissions.length
      : 0;

    res.json({
      test,
      summary: {
        totalSubmissions: submissions.length,
        gradedSubmissions: gradedSubmissions.length,
        averagePercentage: Number(averagePercentage.toFixed(2)),
        submittedStudents: submissions.filter((submission) => submission.status !== 'in_progress').length
      },
      submissions,
      questions: questionResult.rows
    });
  } catch (error) {
    console.error('Error fetching student test results:', error);
    res.status(500).json({ message: 'Error fetching test results' });
  }
};

// Get test analytics (for teacher)
export const getTestAnalytics = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Overall stats
    const statsResult = await pool.query(
      `SELECT COUNT(*) as total_submissions, 
              AVG(percentage) as avg_percentage,
              MIN(percentage) as min_percentage,
              MAX(percentage) as max_percentage
       FROM test_submissions
       WHERE test_id = $1 AND status = 'graded'`,
      [parseInt(testId)]
    );

    // Question-wise performance
    const questionsResult = await pool.query(
      `SELECT tq.id, tq.question_number, tq.question_text,
              COUNT(ta.id) as total_attempts,
              SUM(CASE WHEN ta.is_correct THEN 1 ELSE 0 END) as correct_answers,
              COALESCE(
                ROUND(
                  SUM(CASE WHEN ta.is_correct THEN 1 ELSE 0 END)::numeric
                  / NULLIF(COUNT(ta.id), 0) * 100,
                  2
                ),
                0
              ) as success_rate
       FROM test_questions tq
       LEFT JOIN test_answers ta ON tq.id = ta.question_id
       WHERE tq.test_id = $1
       GROUP BY tq.id
       ORDER BY tq.question_number`,
      [parseInt(testId)]
    );

    res.json({
      stats: statsResult.rows[0],
      questionAnalytics: questionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching test analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};

// Generate quiz using Gemini from PDF/notes and save as draft test
export const generateQuizFromPDF = async (req: Request, res: Response) => {
  try {
    const {
      classId,
      subjectId,
      title,
      pdfUrl,
      syllabusTopicId,
      chapterTitle,
      includeCoveredTopics,
      sourceType,
      numQuestions,
      difficulty,
      questionTypes,
      startTime,
      endTime
    } = req.body;
    const teacherId = (req as any).user?.id;

    if (!classId || !subjectId || !title || !teacherId) {
      return res.status(400).json({ message: 'Missing required fields for quiz generation' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ message: 'Gemini API key is missing on server. Please set GEMINI_API_KEY in backend .env' });
    }

    const classInfoResult = await pool.query(
      `SELECT c.name, c.grade, c.section, s.name as subject_name, s.code as subject_code
       FROM classes c
       JOIN subjects s ON s.id = $2
       WHERE c.id = $1`,
      [Number(classId), Number(subjectId)]
    );

    const classInfo = classInfoResult.rows[0];

    let extractedText = '';

    if (sourceType === 'pdf' || pdfUrl) {
      if (!pdfUrl) {
        return res.status(400).json({ message: 'PDF source selected but no PDF uploaded' });
      }
      extractedText = await extractTextFromPDF(pdfUrl);
    } else {
      let topicRows: any[] = [];

      if (syllabusTopicId) {
        const selectedTopic = await pool.query(
          `SELECT st.id, st.syllabus_id, st.topic_number, st.title, st.description, st.status
           FROM syllabus_topics st
           JOIN syllabuses s ON st.syllabus_id = s.id
           WHERE st.id = $1 AND s.class_id = $2 AND s.subject_id = $3`,
          [Number(syllabusTopicId), Number(classId), Number(subjectId)]
        );

        if (selectedTopic.rows.length > 0) {
          const current = selectedTopic.rows[0];
          if (includeCoveredTopics) {
            const previousTopics = await pool.query(
              `SELECT st.topic_number, st.title, st.description, st.status
               FROM syllabus_topics st
               WHERE st.syllabus_id = $1
                 AND st.topic_number <= $2
               ORDER BY st.topic_number`,
              [current.syllabus_id, current.topic_number]
            );
            topicRows = previousTopics.rows;
          } else {
            topicRows = [current];
          }
        }
      }

      if (topicRows.length === 0) {
        const coveredTopics = await pool.query(
          `SELECT st.topic_number, st.title, st.description, st.status
           FROM syllabus_topics st
           JOIN syllabuses s ON st.syllabus_id = s.id
           WHERE s.class_id = $1
             AND s.subject_id = $2
             AND st.status IN ('covered', 'ongoing')
           ORDER BY st.topic_number`,
          [Number(classId), Number(subjectId)]
        );
        topicRows = coveredTopics.rows;
      }

      if (topicRows.length === 0 && !chapterTitle) {
        return res.status(400).json({ message: 'No syllabus topics found for this class/subject. Select a topic or upload PDF.' });
      }

      const chapterContext = chapterTitle ? `Target Chapter/Unit: ${chapterTitle}\n\n` : '';
      const topicsContext = topicRows.length > 0
        ? topicRows
            .map((row) => `Topic ${row.topic_number}: ${row.title}${row.description ? ` - ${row.description}` : ''} [${row.status}]`)
            .join('\n')
        : 'No syllabus topics available.';

      extractedText = `${chapterContext}Syllabus Topic Context:\n${topicsContext}`;
    }

    const generated = await generateQuizFromContent({
      content: extractedText,
      title,
      numQuestions: Number(numQuestions) || 10,
      difficulty: difficulty || 'medium',
      questionTypes: Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ['mcq'],
      audienceContext: `Class: ${classInfo?.name || classId} | Grade: ${classInfo?.grade || ''} ${classInfo?.section || ''} | Subject: ${classInfo?.subject_name || subjectId} (${classInfo?.subject_code || ''}) | Test source: ${sourceType === 'pdf' || pdfUrl ? 'uploaded PDF notes' : 'syllabus topic or chapter'}`
    });

    const testResult = await pool.query(
      `INSERT INTO tests (class_id, subject_id, teacher_id, title, description, test_type, status, total_questions, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, 'ai_generated', 'draft', $6, $7, $8)
       RETURNING *`,
      [
        classId,
        subjectId,
        teacherId,
        title,
        sourceType === 'pdf' || pdfUrl
          ? 'AI generated quiz from uploaded notes/PDF'
          : 'AI generated quiz from syllabus topics/chapter context',
        generated.questions.length,
        startTime || null,
        endTime || null
      ]
    );

    const testId = testResult.rows[0].id;

    for (const q of generated.questions) {
      const questionResult = await pool.query(
        `INSERT INTO test_questions (test_id, question_number, question_text, question_type, correct_answer, points, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          testId,
          q.questionNumber,
          q.questionText,
          q.questionType,
          q.correctAnswer || null,
          q.points || 1,
          q.difficulty || 'medium'
        ]
      );

      const questionId = questionResult.rows[0].id;
      if (q.questionType === 'mcq' && Array.isArray(q.options)) {
        for (const option of q.options) {
          await pool.query(
            `INSERT INTO question_options (question_id, option_number, option_text, is_correct)
             VALUES ($1, $2, $3, $4)`,
            [questionId, option.optionNumber, option.optionText, Boolean(option.isCorrect)]
          );
        }
      }
    }

    return res.status(201).json({
      message: 'Quiz generated and scheduled successfully',
      test: testResult.rows[0],
      generatedQuestionCount: generated.questions.length
    });
  } catch (error: any) {
    console.error('Generate quiz from PDF error:', error);
    const message = String(error?.message || 'Error generating quiz');

    if (message.toLowerCase().includes('api key')) {
      return res.status(400).json({ message });
    }
    if (message.toLowerCase().includes('quota') || message.toLowerCase().includes('permission')) {
      return res.status(502).json({ message: `Gemini API error: ${message}` });
    }
    if (message.toLowerCase().includes('pdf')) {
      return res.status(400).json({ message });
    }

    return res.status(500).json({ message });
  }
};
