import { Request, Response } from 'express';
import pool from '../config/database';
import { extractTextFromPDF, generateQuizFromContent } from '../services/geminiService';

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

// Get test with all questions
export const getTest = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const role = (req as any).user?.role;

    const testResult = await pool.query('SELECT * FROM tests WHERE id = $1', [parseInt(testId)]);

    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const questionsResult = await pool.query(
      `SELECT tq.*, 
              array_agg(json_build_object('id', qo.id, 'optionNumber', qo.option_number, 'optionText', qo.option_text, 'isCorrect', qo.is_correct) 
               ORDER BY qo.option_number) as options
       FROM test_questions tq
       LEFT JOIN question_options qo ON tq.id = qo.question_id
       WHERE tq.test_id = $1
       GROUP BY tq.id
       ORDER BY tq.question_number`,
      [parseInt(testId)]
    );

    const test = testResult.rows[0];
    const questions = questionsResult.rows || [];

    test.questions = questions.map((question: any) => {
      if (role === 'student') {
        return {
          ...question,
          correct_answer: undefined,
          options: Array.isArray(question.options)
            ? question.options.map((option: any) => ({
                ...option,
                isCorrect: undefined
              }))
            : []
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

    const result = await pool.query(
      `UPDATE tests 
       SET status = $1, start_time = $2, end_time = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, startTime || null, endTime || null, parseInt(testId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.json({
      message: `Test ${status} successfully`,
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

    const result = await pool.query(
      `SELECT t.*, s.name as subject_name
       FROM tests t
       JOIN subjects s ON t.subject_id = s.id
       WHERE t.class_id = $1 AND t.status IN ('scheduled', 'active', 'completed')
       ORDER BY t.start_time DESC`,
      [parseInt(classId as string)]
    );

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

    // Create submission
    const submissionResult = await pool.query(
      `INSERT INTO test_submissions (test_id, student_id, class_id, submitted_at, status)
       SELECT $1, $2, class_id, CURRENT_TIMESTAMP, 'submitted'
       FROM tests
       WHERE id = $1
       RETURNING *`,
      [parseInt(testId), studentId]
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const submissionId = submissionResult.rows[0].id;

    // Auto-grade MCQs and calculate score
    let totalScore = 0;
    let maxScore = 0;

    for (const answer of answers) {
      const questionResult = await pool.query(
        'SELECT * FROM test_questions WHERE id = $1',
        [answer.questionId]
      );

      if (questionResult.rows.length === 0) continue;

      const question = questionResult.rows[0];
      maxScore += question.points;

      let isCorrect = false;
      let pointsAwarded = 0;

      if (question.question_type === 'mcq') {
        const optionResult = await pool.query(
          'SELECT is_correct FROM question_options WHERE id = $1',
          [answer.answer]
        );

        if (optionResult.rows.length > 0 && optionResult.rows[0].is_correct) {
          isCorrect = true;
          pointsAwarded = question.points;
          totalScore += pointsAwarded;
        }
      } else if (question.question_type === 'true_false') {
        isCorrect = String(answer.answer).toLowerCase() === String(question.correct_answer).toLowerCase();
        if (isCorrect) {
          pointsAwarded = question.points;
          totalScore += pointsAwarded;
        }
      }
      // Short answer and long answer require manual grading

      // Save answer
      await pool.query(
        `INSERT INTO test_answers (submission_id, question_id, student_answer, points_awarded, is_correct)
         VALUES ($1, $2, $3, $4, $5)`,
        [submissionId, answer.questionId, String(answer.answer), pointsAwarded, isCorrect]
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
    console.error('Error submitting test:', error);
    res.status(500).json({ message: 'Error submitting test' });
  }
};

// Get student test results
export const getStudentTestResults = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const studentId = (req as any).user?.id;

    const result = await pool.query(
      `SELECT ts.*, t.title, t.show_answers, s.name as subject_name
       FROM test_submissions ts
       JOIN tests t ON ts.test_id = t.id
       JOIN subjects s ON t.subject_id = s.id
       WHERE ts.test_id = $1 AND ts.student_id = $2`,
      [parseInt(testId), studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Test submission not found' });
    }

    res.json({ submission: result.rows[0] });
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
              ROUND(SUM(CASE WHEN ta.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(ta.id) * 100, 2) as success_rate
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
      numQuestions,
      difficulty,
      questionTypes,
      startTime,
      endTime
    } = req.body;
    const teacherId = (req as any).user?.id;

    if (!classId || !subjectId || !title || !pdfUrl || !teacherId) {
      return res.status(400).json({ message: 'Missing required fields for quiz generation' });
    }

    const extractedText = await extractTextFromPDF(pdfUrl);
    const generated = await generateQuizFromContent({
      content: extractedText,
      title,
      numQuestions: Number(numQuestions) || 10,
      difficulty: difficulty || 'medium',
      questionTypes: Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ['mcq']
    });

    const testResult = await pool.query(
      `INSERT INTO tests (class_id, subject_id, teacher_id, title, description, test_type, status, total_questions, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, 'ai_generated', 'scheduled', $6, $7, $8)
       RETURNING *`,
      [
        classId,
        subjectId,
        teacherId,
        title,
        'AI generated quiz from uploaded notes/PDF',
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
    return res.status(500).json({ message: error.message || 'Error generating quiz' });
  }
};
