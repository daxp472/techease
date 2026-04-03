import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import SearchInput from '../components/ui/SearchInput';
import { classAPI, syllabusAPI, testAPI, studentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { Class, Subject } from '../types';

interface TestRow {
  id: number;
  title: string;
  description?: string;
  instructions?: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  start_time?: string;
  end_time?: string;
  total_questions?: number;
  subject_name?: string;
  subjectName?: string;
  subjectCode?: string;
  className?: string;
  classGrade?: string;
  classSection?: string;
  teacherFirstName?: string;
  teacherLastName?: string;
  test_type?: string;
  show_answers?: boolean;
  shuffle_questions?: boolean;
  duration_minutes?: number;
  passing_score?: number;
  submission_status?: 'in_progress' | 'submitted' | 'graded';
  submission_score?: number;
  submission_total_score?: number;
  submission_percentage?: number;
}

interface TestAnswerRow {
  questionId: number;
  questionNumber: number;
  questionText: string;
  questionType: string;
  studentAnswer: string;
  pointsAwarded?: number;
  maxPoints?: number;
  isCorrect?: boolean;
}

interface TestSubmissionRow {
  id: number;
  studentId: number;
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  score?: number;
  totalScore?: number;
  percentage?: number;
  status?: string;
  startedAt?: string;
  submittedAt?: string;
  answers?: TestAnswerRow[];
  failedQuestions?: Array<{
    questionNumber: number;
    questionText: string;
    questionType: string;
    studentAnswer: string;
    pointsAwarded?: number;
    maxPoints?: number;
    isCorrect?: boolean;
  }>;
}

interface StudentResultState {
  test: any;
  submission: {
    score?: number;
    total_score?: number;
    percentage?: number;
    status?: string;
    submitted_at?: string;
  };
}

interface DraftOption {
  optionNumber: number;
  optionText: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  questionNumber: number;
  questionText: string;
  questionType: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
  correctAnswer: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  options: DraftOption[];
}

interface ReviewQuestion {
  id?: number;
  questionNumber: number;
  questionText: string;
  questionType: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
  correctAnswer: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  options: DraftOption[];
}

const emptyQuestion = (questionNumber: number): DraftQuestion => ({
  questionNumber,
  questionText: '',
  questionType: 'mcq',
  correctAnswer: '',
  points: 1,
  difficulty: 'medium',
  options: [
    { optionNumber: 1, optionText: '', isCorrect: false },
    { optionNumber: 2, optionText: '', isCorrect: true },
    { optionNumber: 3, optionText: '', isCorrect: false },
    { optionNumber: 4, optionText: '', isCorrect: false }
  ]
});

const normalizeQuestion = (question: any) => ({
  id: Number(question.id),
  questionNumber: Number(question.questionNumber ?? question.question_number ?? question.question_no ?? 0),
  questionText: question.questionText ?? question.question_text ?? '',
  questionType: question.questionType ?? question.question_type ?? 'mcq',
  correctAnswer: question.correctAnswer ?? question.correct_answer ?? '',
  points: Number(question.points ?? 1),
  difficulty: question.difficulty ?? 'medium',
  options: Array.isArray(question.options)
    ? question.options
        .filter((option: any) => option && (option.id ?? option.optionNumber ?? option.option_number))
        .map((option: any) => ({
          id: option.id,
          optionNumber: option.optionNumber ?? option.option_number,
          optionText: option.optionText ?? option.option_text ?? '',
          isCorrect: Boolean(option.isCorrect ?? option.is_correct)
        }))
    : []
});

const normalizeTestDetails = (test: any) => ({
  ...test,
  className: test.className ?? test.class_name ?? '',
  classGrade: test.classGrade ?? test.class_grade ?? '',
  classSection: test.classSection ?? test.class_section ?? '',
  subjectName: test.subjectName ?? test.subject_name ?? '',
  subjectCode: test.subjectCode ?? test.subject_code ?? '',
  teacherFirstName: test.teacherFirstName ?? test.teacher_first_name ?? '',
  teacherLastName: test.teacherLastName ?? test.teacher_last_name ?? '',
  duration_minutes: test.duration_minutes ?? test.durationMinutes ?? null,
  passing_score: test.passing_score ?? test.passingScore ?? null,
  instructions: test.instructions ?? '',
  questions: Array.isArray(test.questions) ? test.questions.map(normalizeQuestion) : []
});

const toReviewQuestion = (question: any, index: number): ReviewQuestion => ({
  id: question.id,
  questionNumber: Number(question.questionNumber ?? index + 1),
  questionText: question.questionText ?? '',
  questionType: question.questionType ?? 'mcq',
  correctAnswer: question.correctAnswer ?? '',
  points: Number(question.points ?? 1),
  difficulty: question.difficulty ?? 'medium',
  options: Array.isArray(question.options) && question.options.length > 0
    ? question.options.map((option: any, optionIndex: number) => ({
        optionNumber: Number(option.optionNumber ?? optionIndex + 1),
        optionText: option.optionText ?? '',
        isCorrect: Boolean(option.isCorrect)
      }))
    : [
        { optionNumber: 1, optionText: '', isCorrect: false },
        { optionNumber: 2, optionText: '', isCorrect: true },
        { optionNumber: 3, optionText: '', isCorrect: false },
        { optionNumber: 4, optionText: '', isCorrect: false }
      ]
});

const Tests: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [topics, setTopics] = useState<Array<{ id: number; title: string }>>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [creatingManual, setCreatingManual] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [startingTest, setStartingTest] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewStep, setReviewStep] = useState<'edit' | 'schedule'>('edit');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAiCreate, setShowAiCreate] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [studentResult, setStudentResult] = useState<StudentResultState | null>(null);
  const [testResults, setTestResults] = useState<{ summary?: any; submissions?: TestSubmissionRow[]; questions?: any[] } | null>(null);
  const [testAnalytics, setTestAnalytics] = useState<any | null>(null);
  const [reviewTest, setReviewTest] = useState<any | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [reviewSchedule, setReviewSchedule] = useState({
    startTime: '',
    endTime: '',
    durationMinutes: 60,
    passingScore: 35,
    instructions: ''
  });
  const [aiSource, setAiSource] = useState<'topic' | 'pdf'>('topic');
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileData, setPdfFileData] = useState('');
  const [form, setForm] = useState({
    classId: '',
    subjectId: '',
    title: '',
    description: '',
    instructions: '',
    startTime: '',
    endTime: ''
  });
  const [aiForm, setAiForm] = useState({
    classId: '',
    subjectId: '',
    topicId: '',
    chapterTitle: '',
    includePreviousTopics: true,
    title: '',
    numQuestions: 5,
    difficulty: 'medium',
    questionMode: 'mix'
  });
  const [questionDrafts, setQuestionDrafts] = useState<DraftQuestion[]>([emptyQuestion(1)]);

  useEffect(() => {
    const init = async () => {
      try {
        const [classRes, subjectRes] = await Promise.all([classAPI.getAll(), classAPI.getSubjects()]);
        setClasses(classRes.data.classes || []);
        setSubjects(subjectRes.data.subjects || []);
        if (user?.role === 'student') {
          const studentRes = await studentAPI.getById(user.id);
          const classId = studentRes.data.student?.classId;
          if (classId) {
            setSelectedClass(String(classId));
          }
        }
      } catch {
        showToast('Unable to load classes or subjects', 'error');
      }
    };
    void init();
  }, [showToast]);

  useEffect(() => {
    const loadTopics = async () => {
      if (!aiForm.classId || !aiForm.subjectId) {
        setTopics([]);
        return;
      }
      try {
        const response = await syllabusAPI.getByClass({ classId: Number(aiForm.classId), subjectId: Number(aiForm.subjectId) });
        const syllabus = response.data.syllabus;
        setTopics(Array.isArray(syllabus?.topics) ? syllabus.topics : []);
      } catch {
        setTopics([]);
      }
    };
    void loadTopics();
  }, [aiForm.classId, aiForm.subjectId]);

  useEffect(() => {
    const loadTests = async () => {
      setLoading(true);
      try {
        const params = selectedClass ? { classId: Number(selectedClass) } : {};
        const res = await testAPI.getByClass(params);
        setTests(res.data.tests || []);
      } catch {
        showToast('Unable to load tests', 'error');
      } finally {
        setLoading(false);
      }
    };
    void loadTests();
  }, [selectedClass, showToast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const statusPriority: Record<string, number> = { active: 0, scheduled: 1, completed: 2, archived: 3, draft: 4 };
    const source = q
      ? tests.filter((t) => (`${t.title} ${t.subject_name || ''} ${t.status}`).toLowerCase().includes(q))
      : tests;

    return source.slice().sort((a, b) => {
      const byStatus = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (byStatus !== 0) return byStatus;
      const aStart = a.start_time ? new Date(a.start_time).getTime() : 0;
      const bStart = b.start_time ? new Date(b.start_time).getTime() : 0;
      return bStart - aStart;
    });
  }, [search, tests]);

  const updateDraftQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setQuestionDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const updateDraftOption = (questionIndex: number, optionIndex: number, patch: Partial<DraftOption>) => {
    setQuestionDrafts((current) => current.map((item, itemIndex) => {
      if (itemIndex !== questionIndex) return item;
      const options = item.options.map((option, currentIndex) => currentIndex === optionIndex ? { ...option, ...patch } : option);
      return { ...item, options };
    }));
  };

  const addDraftQuestion = () => {
    setQuestionDrafts((current) => [...current, emptyQuestion(current.length + 1)]);
  };

  const removeDraftQuestion = (index: number) => {
    setQuestionDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, questionNumber: itemIndex + 1 })));
  };

  const createManualTest = async () => {
    if (!form.classId || !form.subjectId || !form.title) {
      showToast('Class, subject, and title are required', 'error');
      return;
    }
    if (questionDrafts.length === 0) {
      showToast('Add at least one question', 'error');
      return;
    }

    const validQuestions = questionDrafts.filter((question) => question.questionText.trim());
    if (validQuestions.length === 0) {
      showToast('Add question text before saving', 'error');
      return;
    }

    setCreatingManual(true);
    try {
      const testRes = await testAPI.create({
        classId: Number(form.classId),
        subjectId: Number(form.subjectId),
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        testType: 'manual',
        totalQuestions: validQuestions.length,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        showAnswers: false,
        shuffleQuestions: true
      });

      const testId = testRes.data.test.id;
      for (const question of validQuestions) {
        await testAPI.addQuestion(testId, {
          questionNumber: question.questionNumber,
          questionText: question.questionText,
          questionType: question.questionType,
          correctAnswer: question.correctAnswer,
          points: question.points,
          difficulty: question.difficulty,
          options: question.options
        });
      }

      await testAPI.publish(testId, {
        status: form.startTime ? 'scheduled' : 'active',
        startTime: form.startTime || null,
        endTime: form.endTime || null
      });

      showToast('Test created successfully', 'success');
      setForm({ classId: '', subjectId: '', title: '', description: '', instructions: '', startTime: '', endTime: '' });
      setQuestionDrafts([emptyQuestion(1)]);
      if (selectedClass) {
        const listRes = await testAPI.getByClass({ classId: Number(selectedClass) });
        setTests(listRes.data.tests || []);
      }
      setShowCreate(false);
      await openTestDetails(testId);
    } catch {
      showToast('Unable to create test', 'error');
    } finally {
      setCreatingManual(false);
    }
  };

  const createAiTest = async () => {
    if (!aiForm.classId || !aiForm.subjectId || !aiForm.title) {
      showToast('Please select class, subject, and title', 'error');
      return;
    }

    if (aiSource === 'pdf' && !pdfFileData) {
      showToast('Please upload PDF notes for PDF-based quiz generation', 'error');
      return;
    }

    if (aiSource === 'topic' && !aiForm.topicId && !aiForm.chapterTitle.trim()) {
      showToast('Please select a syllabus topic or enter chapter title', 'error');
      return;
    }

    setGeneratingAi(true);
    try {
      const questionTypes = aiForm.questionMode === 'mix'
        ? ['mcq', 'short_answer']
        : [aiForm.questionMode];

      const response = await testAPI.generateQuiz({
        classId: Number(aiForm.classId),
        subjectId: Number(aiForm.subjectId),
        syllabusTopicId: aiForm.topicId ? Number(aiForm.topicId) : null,
        chapterTitle: aiForm.chapterTitle || null,
        includeCoveredTopics: aiForm.includePreviousTopics,
        sourceType: aiSource,
        title: aiForm.title,
        pdfUrl: aiSource === 'pdf' ? pdfFileData : null,
        pdfFileName,
        numQuestions: Number(aiForm.numQuestions),
        difficulty: aiForm.difficulty,
        questionTypes
      });
      showToast('AI quiz generated - review and make changes before activating', 'success');
      setShowAiCreate(false);
      
      const generatedTestId = response.data?.test?.id;
      if (generatedTestId) {
        const testDetails = await testAPI.getById(Number(generatedTestId));
        const normalized = normalizeTestDetails(testDetails.data.test);
        setReviewTest(normalized);
        setReviewQuestions((normalized.questions || []).map(toReviewQuestion));
        setReviewStep('edit');
        setReviewSchedule({
          startTime: normalized.start_time ? new Date(normalized.start_time).toISOString().slice(0, 16) : '',
          endTime: normalized.end_time ? new Date(normalized.end_time).toISOString().slice(0, 16) : '',
          durationMinutes: Number(normalized.duration_minutes || 60),
          passingScore: Number(normalized.passing_score || 35),
          instructions: normalized.instructions || ''
        });
      }
      
      setAiForm({
        classId: '',
        subjectId: '',
        topicId: '',
        chapterTitle: '',
        includePreviousTopics: true,
        title: '',
        numQuestions: 5,
        difficulty: 'medium',
        questionMode: 'mix'
      });
      setPdfFileName('');
      setPdfFileData('');

      const listRes = await testAPI.getByClass(selectedClass ? { classId: Number(selectedClass) } : {});
      setTests(listRes.data.tests || []);
    } catch {
      showToast('AI quiz generation failed. Check Gemini API key and uploaded file.', 'error');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handlePdfUpload = async (file: File | null) => {
    if (!file) return;
    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfFileData(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const canTakeTestNow = (test: TestRow) => {
    const now = Date.now();
    const start = test.start_time ? new Date(test.start_time).getTime() : null;
    const end = test.end_time ? new Date(test.end_time).getTime() : null;
    if (!start || !end) return test.status === 'active';
    return now >= start && now <= end;
  };

  const hasStudentSubmitted = (test: TestRow) => {
    if (user?.role !== 'student') return false;
    return ['submitted', 'graded'].includes(String(test.submission_status || ''));
  };

  const hasTestEnded = (test: TestRow) => {
    if (test.status === 'completed') return true;
    if (!test.end_time) return false;
    return Date.now() > new Date(test.end_time).getTime();
  };

  const isTeacherEditLocked = (test: any) => {
    if (!test) return true;
    if (test.status === 'active' || test.status === 'completed') return true;
    const start = test.start_time ? new Date(test.start_time).getTime() : (test.startTime ? new Date(test.startTime).getTime() : null);
    return Boolean(start && Date.now() >= start);
  };

  const openStudentResult = async (testId: number) => {
    setResultsLoading(true);
    try {
      const response = await testAPI.getResults(testId);
      setStudentResult(response.data);
    } catch {
      showToast('Result is not available yet for this test.', 'info');
    } finally {
      setResultsLoading(false);
    }
  };

  const openTestDetails = async (testId: number) => {
    setDetailLoading(true);
    setResultsLoading(true);
    try {
      const [detailResponse, resultsResponse, analyticsResponse] = await Promise.all([
        testAPI.getById(testId),
        user?.role === 'student' ? Promise.resolve(null) : testAPI.getResults(testId),
        user?.role === 'student' ? Promise.resolve(null) : testAPI.getAnalytics(testId)
      ]);

      setSelectedTest(normalizeTestDetails(detailResponse.data.test));
      setTestResults(resultsResponse?.data || null);
      setTestAnalytics(analyticsResponse?.data || null);
    } catch {
      showToast('Unable to load test details', 'error');
    } finally {
      setDetailLoading(false);
      setResultsLoading(false);
    }
  };

  const updateReviewQuestion = (index: number, patch: Partial<ReviewQuestion>) => {
    setReviewQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...patch } : question
    )));
  };

  const updateReviewOption = (questionIndex: number, optionIndex: number, patch: Partial<DraftOption>) => {
    setReviewQuestions((current) => current.map((question, currentIndex) => {
      if (currentIndex !== questionIndex) return question;
      const options = question.options.map((option, currentOptionIndex) => (
        currentOptionIndex === optionIndex ? { ...option, ...patch } : option
      ));
      return { ...question, options };
    }));
  };

  const addReviewQuestion = () => {
    setReviewQuestions((current) => [
      ...current,
      {
        questionNumber: current.length + 1,
        questionText: '',
        questionType: 'mcq',
        correctAnswer: '',
        points: 1,
        difficulty: 'medium',
        options: [
          { optionNumber: 1, optionText: '', isCorrect: false },
          { optionNumber: 2, optionText: '', isCorrect: true },
          { optionNumber: 3, optionText: '', isCorrect: false },
          { optionNumber: 4, optionText: '', isCorrect: false }
        ]
      }
    ]);
  };

  const removeReviewQuestion = (index: number) => {
    setReviewQuestions((current) => current
      .filter((_, questionIndex) => questionIndex !== index)
      .map((question, questionIndex) => ({ ...question, questionNumber: questionIndex + 1 })));
  };

  const proceedToSchedule = () => {
    const validQuestions = reviewQuestions.filter((question) => question.questionText.trim());
    if (validQuestions.length === 0) {
      showToast('Add at least one valid question before proceeding', 'error');
      return;
    }
    setReviewStep('schedule');
  };

  const startSelectedTest = async () => {
    if (!selectedTest) return;
    setStartingTest(true);
    try {
      const now = new Date().toISOString();
      const response = await testAPI.publish(selectedTest.id, {
        status: 'active',
        startTime: now,
        endTime: selectedTest.endTime || selectedTest.end_time || null
      });

      const refreshedTest = normalizeTestDetails(response.data.test);
      setSelectedTest(refreshedTest);
      if (selectedClass) {
        const listRes = await testAPI.getByClass({ classId: Number(selectedClass) });
        setTests(listRes.data.tests || []);
      }
      showToast('Test started successfully', 'success');
      await openTestDetails(selectedTest.id);
    } catch {
      showToast('Unable to start test', 'error');
    } finally {
      setStartingTest(false);
    }
  };

  const editSelectedTest = () => {
    if (!selectedTest || isTeacherEditLocked(selectedTest)) {
      showToast('Editing is closed after test start time', 'info');
      return;
    }

    const normalized = normalizeTestDetails(selectedTest);
    setReviewTest(normalized);
    setReviewQuestions((normalized.questions || []).map(toReviewQuestion));
    setReviewStep('edit');
    setReviewSchedule({
      startTime: normalized.start_time ? new Date(normalized.start_time).toISOString().slice(0, 16) : '',
      endTime: normalized.end_time ? new Date(normalized.end_time).toISOString().slice(0, 16) : '',
      durationMinutes: Number(normalized.duration_minutes || 60),
      passingScore: Number(normalized.passing_score || 35),
      instructions: normalized.instructions || ''
    });
    setSelectedTest(null);
  };

  const publishReviewTest = async () => {
    if (!reviewTest) return;
    const validQuestions = reviewQuestions.filter((question) => question.questionText.trim());
    if (validQuestions.length === 0) {
      showToast('Add at least one valid question before publishing', 'error');
      return;
    }

    if (!reviewSchedule.startTime || !reviewSchedule.endTime) {
      showToast('Please set start and end time before publishing', 'error');
      return;
    }

    if (new Date(reviewSchedule.endTime).getTime() <= new Date(reviewSchedule.startTime).getTime()) {
      showToast('End time must be after start time', 'error');
      return;
    }

    if (reviewSchedule.durationMinutes <= 0) {
      showToast('Duration must be greater than zero', 'error');
      return;
    }

    setSavingReview(true);
    try {
      await testAPI.replaceQuestions(reviewTest.id, {
        questions: validQuestions.map((question, questionIndex) => {
          const normalizedOptions = question.questionType === 'mcq'
            ? question.options
                .map((option, optionIndex) => ({
                  optionNumber: optionIndex + 1,
                  optionText: option.optionText,
                  isCorrect: option.isCorrect
                }))
                .filter((option) => option.optionText.trim())
            : [];

          return {
            questionNumber: questionIndex + 1,
            questionText: question.questionText,
            questionType: question.questionType,
            correctAnswer: question.correctAnswer,
            points: question.points,
            difficulty: question.difficulty,
            options: normalizedOptions
          };
        })
      });

      await testAPI.updateSettings(reviewTest.id, {
        title: reviewTest.title,
        description: reviewTest.description,
        instructions: reviewSchedule.instructions || null,
        durationMinutes: Number(reviewSchedule.durationMinutes),
        passingScore: Number(reviewSchedule.passingScore),
        startTime: new Date(reviewSchedule.startTime).toISOString(),
        endTime: new Date(reviewSchedule.endTime).toISOString()
      });

      const startTimeIso = new Date(reviewSchedule.startTime).toISOString();
      const endTimeIso = new Date(reviewSchedule.endTime).toISOString();
      const shouldActivateNow = new Date(startTimeIso).getTime() <= Date.now();

      await testAPI.publish(reviewTest.id, {
        status: shouldActivateNow ? 'active' : 'scheduled',
        startTime: startTimeIso,
        endTime: endTimeIso
      });

      showToast('Test published successfully and is now scheduled for students', 'success');
      setReviewTest(null);
      setReviewQuestions([]);
      setReviewStep('edit');

      const listRes = await testAPI.getByClass(selectedClass ? { classId: Number(selectedClass) } : {});
      setTests(listRes.data.tests || []);
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Unable to publish test', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <Layout>
      <div>
        <PageHeader
          title="Tests & Quiz System"
          description="Create manual tests, generate AI quizzes from uploaded notes, and run scheduled assessments"
          actions={
            (user?.role === 'teacher' || user?.role === 'admin') ? (
              <>
                <button className="btn-secondary" onClick={() => setShowAiCreate(true)}>Generate Quiz from PDF</button>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Manual Test</button>
              </>
            ) : null
          }
        />

        <div className="card mb-6 grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <select className="input-base" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">Select class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name} - Grade {cls.grade} {cls.section}</option>
            ))}
          </select>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tests" />
        </div>

        {loading ? (
          <LoadingState message="Loading tests..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No tests found" description="Try changing class filter or create a new test." />
        ) : (
          <div className="space-y-3">
            {filtered.map((test) => (
              <div
                key={test.id}
                onClick={() => {
                  if (user?.role === 'student' && hasTestEnded(test)) {
                    void openStudentResult(test.id);
                    return;
                  }
                  void openTestDetails(test.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (user?.role === 'student' && hasTestEnded(test)) {
                      void openStudentResult(test.id);
                      return;
                    }
                    void openTestDetails(test.id);
                  }
                }}
                className="card flex w-full cursor-pointer flex-col gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{test.title}</h3>
                  <p className="text-sm text-slate-600">{test.subject_name || test.subjectName || 'Subject'} • {test.total_questions || 0} questions</p>
                  {test.start_time ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Window: {new Date(test.start_time).toLocaleString()} - {test.end_time ? new Date(test.end_time).toLocaleString() : 'No end'}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{test.status}</span>
                  {user?.role === 'student' && !hasStudentSubmitted(test) && canTakeTestNow(test) ? (
                    <Link to={`/student/tests/${test.id}/attempt`} className="btn-primary" onClick={(event) => event.stopPropagation()}>Start Test</Link>
                  ) : null}
                  {user?.role === 'student' && hasStudentSubmitted(test) ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openStudentResult(test.id);
                      }}
                    >
                      View Result
                    </button>
                  ) : null}
                  {user?.role === 'student' && !canTakeTestNow(test) && hasTestEnded(test) ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openStudentResult(test.id);
                      }}
                    >
                      View Score
                    </button>
                  ) : null}
                </div>
                {user?.role === 'student' && hasStudentSubmitted(test) ? (
                  <div className="mt-2 text-xs text-slate-600 md:mt-0">
                    Score: {Number(test.submission_score || 0)} / {Number(test.submission_total_score || 0)} ({Math.round(Number(test.submission_percentage || 0))}%)
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {studentResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Your Test Result</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">{studentResult.test?.title || 'Test'}</h2>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setStudentResult(null)}>
                  Close
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Score</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(studentResult.submission?.score || 0)} / {Number(studentResult.submission?.total_score || 0)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Percentage</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{Math.round(Number(studentResult.submission?.percentage || 0))}%</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-bold capitalize text-slate-900">{studentResult.submission?.status || 'submitted'}</p>
                </div>
              </div>

              {studentResult.submission?.submitted_at ? (
                <p className="mt-4 text-sm text-slate-600">Submitted on: {new Date(studentResult.submission.submitted_at).toLocaleString()}</p>
              ) : null}
            </div>
          </div>
        )}

        {selectedTest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              {detailLoading ? (
                <LoadingState compact message="Loading test details..." />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Test Details</p>
                      <h2 className="mt-1 text-2xl font-bold text-slate-900">{selectedTest.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedTest.subjectName || selectedTest.subject_name || 'Subject'}
                        {selectedTest.subjectCode ? ` • ${selectedTest.subjectCode}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {(user?.role === 'teacher' || user?.role === 'admin') && !isTeacherEditLocked(selectedTest) ? (
                        <button type="button" className="btn-secondary" onClick={editSelectedTest}>
                          Edit Questions
                        </button>
                      ) : null}
                      {(user?.role === 'teacher' || user?.role === 'admin') && selectedTest.status !== 'active' && !isTeacherEditLocked(selectedTest) ? (
                        <button type="button" className="btn-primary" onClick={() => void startSelectedTest()} disabled={startingTest}>
                          {startingTest ? 'Starting...' : 'Start Test'}
                        </button>
                      ) : null}
                      <button type="button" className="btn-secondary" onClick={() => setSelectedTest(null)}>
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Class</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedTest.className || 'Unknown'}
                        {selectedTest.classGrade ? ` - Grade ${selectedTest.classGrade}` : ''}
                        {selectedTest.classSection ? ` ${selectedTest.classSection}` : ''}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Teacher</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedTest.teacherFirstName || ''} {selectedTest.teacherLastName || ''}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">{selectedTest.status}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Questions</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedTest.total_questions || selectedTest.questions?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedTest.duration_minutes || '-'} min</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Passing Score</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{selectedTest.passing_score ?? '-'}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">Description</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTest.description || 'No description provided.'}</p>
                  </div>

                  {selectedTest.instructions ? (
                    <div className="mt-4 rounded-2xl bg-teal-50 p-4">
                      <p className="text-sm font-semibold text-teal-800">Instructions</p>
                      <p className="mt-2 text-sm leading-6 text-teal-900">{selectedTest.instructions}</p>
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Questions Preview</h3>
                      {user?.role === 'student' && canTakeTestNow(selectedTest) ? (
                        <Link to={`/student/tests/${selectedTest.id}/attempt`} className="btn-primary" onClick={(event) => event.stopPropagation()}>
                          Start Test
                        </Link>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {(selectedTest.questions || []).map((question: any) => (
                        <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {question.questionNumber}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-900">{question.questionText}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{question.questionType}</span>
                          </div>

                          {Array.isArray(question.options) && question.options.length > 0 ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {question.options.map((option: any) => (
                                <div key={option.id || option.optionNumber} className={`rounded-xl border px-3 py-2 text-sm ${option.isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                                  {option.optionNumber ? `${option.optionNumber}. ` : ''}{option.optionText}
                                  {user?.role !== 'student' && option.isCorrect ? ' • Correct' : ''}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {question.questionType !== 'mcq' && question.correctAnswer && user?.role !== 'student' ? (
                            <p className="mt-3 text-sm font-medium text-emerald-700">Expected answer: {question.correctAnswer}</p>
                          ) : null}

                          {question.questionType === 'mcq' && question.correctAnswer && user?.role !== 'student' ? (
                            <p className="mt-3 text-sm font-medium text-emerald-700">Correct option: {question.correctAnswer}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(user?.role === 'teacher' || user?.role === 'admin') && (
                    <div className="mt-8 space-y-6 border-t border-slate-200 pt-6">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="rounded-2xl bg-teal-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-teal-700">Submissions</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{testResults?.summary?.totalSubmissions ?? 0}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Submitted</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{testResults?.summary?.submittedStudents ?? 0}</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-amber-700">Graded</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{testResults?.summary?.gradedSubmissions ?? 0}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Average %</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{Math.round(testResults?.summary?.averagePercentage || 0)}%</p>
                        </div>
                      </div>

                      {resultsLoading ? (
                        <LoadingState compact message="Loading test results..." />
                      ) : (
                        <>
                          <div>
                            <h3 className="mb-3 text-lg font-semibold text-slate-900">Student Results</h3>
                            <div className="space-y-3">
                              {(testResults?.submissions || []).length > 0 ? (
                                (testResults?.submissions || []).map((submission: TestSubmissionRow) => (
                                  <div key={submission.id} className="rounded-2xl border border-slate-200 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <p className="text-base font-semibold text-slate-900">
                                          {submission.firstName || 'Student'} {submission.lastName || ''}
                                          {submission.rollNumber ? ` • Roll ${submission.rollNumber}` : ''}
                                        </p>
                                        <p className="text-sm text-slate-500">{submission.status || 'in_progress'}</p>
                                      </div>
                                      <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                                          <p className="text-xs uppercase text-slate-500">Score</p>
                                          <p className="font-semibold text-slate-900">{Number(submission.score || 0)} / {Number(submission.totalScore || 0)}</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                                          <p className="text-xs uppercase text-slate-500">Percentage</p>
                                          <p className="font-semibold text-slate-900">{Math.round(Number(submission.percentage || 0))}%</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                                          <p className="text-xs uppercase text-slate-500">Issues</p>
                                          <p className="font-semibold text-slate-900">{submission.failedQuestions?.length || 0}</p>
                                        </div>
                                      </div>
                                    </div>

                                    {(submission.failedQuestions || []).length > 0 ? (
                                      <div className="mt-4 rounded-xl bg-rose-50 p-3">
                                        <p className="text-sm font-semibold text-rose-800">Needs review</p>
                                        <p className="mt-1 text-sm text-rose-900">
                                          Questions: {submission.failedQuestions?.map((question) => `Q${question.questionNumber}`).join(', ')}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">No failing questions recorded yet.</div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <EmptyState
                                  title="No submissions yet"
                                  description="Students will appear here once they complete the test."
                                />
                              )}
                            </div>
                          </div>

                          {(testAnalytics?.questionAnalytics || []).length > 0 && (
                            <div>
                              <h3 className="mb-3 text-lg font-semibold text-slate-900">Question Performance</h3>
                              <div className="space-y-3">
                                {testAnalytics.questionAnalytics.map((question: any) => (
                                  <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {question.question_number}</p>
                                        <p className="text-sm text-slate-900">{question.question_text}</p>
                                      </div>
                                      <div className="text-sm text-slate-600">
                                        {Number(question.correct_answers || 0)} correct / {Number(question.total_attempts || 0)} attempts
                                      </div>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                                      <div
                                        className="h-2 rounded-full bg-teal-500"
                                        style={{ width: `${Math.max(0, Math.min(100, Number(question.success_rate || 0)))}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Create Manual Test</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select className="input-base" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                  <option value="">Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name} - Grade {cls.grade} {cls.section}</option>
                  ))}
                </select>
                <select className="input-base" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>
                  ))}
                </select>
                <input className="input-base md:col-span-2" placeholder="Test title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <input className="input-base md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <textarea className="input-base md:col-span-2 min-h-[90px]" placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
                <label className="text-sm text-slate-600">Start Time</label>
                <input className="input-base" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                <label className="text-sm text-slate-600">End Time</label>
                <input className="input-base" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Questions</h3>
                <button className="btn-secondary" onClick={addDraftQuestion}>Add Question</button>
              </div>

              <div className="mt-4 space-y-4">
                {questionDrafts.map((question, questionIndex) => (
                  <div key={questionIndex} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold text-slate-800">Question {question.questionNumber}</p>
                      {questionDrafts.length > 1 && (
                        <button className="text-sm text-rose-600" onClick={() => removeDraftQuestion(questionIndex)}>Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <textarea className="input-base min-h-[80px]" placeholder="Question text" value={question.questionText} onChange={(e) => updateDraftQuestion(questionIndex, { questionText: e.target.value })} />
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <select className="input-base" value={question.questionType} onChange={(e) => updateDraftQuestion(questionIndex, { questionType: e.target.value as DraftQuestion['questionType'] })}>
                          <option value="mcq">MCQ</option>
                          <option value="short_answer">Short Answer</option>
                          <option value="long_answer">Long Answer</option>
                          <option value="true_false">True / False</option>
                        </select>
                        <select className="input-base" value={question.difficulty} onChange={(e) => updateDraftQuestion(questionIndex, { difficulty: e.target.value as DraftQuestion['difficulty'] })}>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                        <input className="input-base" type="number" min={1} value={question.points} onChange={(e) => updateDraftQuestion(questionIndex, { points: Number(e.target.value) })} placeholder="Points" />
                        <input className="input-base" value={question.correctAnswer} onChange={(e) => updateDraftQuestion(questionIndex, { correctAnswer: e.target.value })} placeholder="Correct answer" />
                      </div>

                      {question.questionType === 'mcq' && (
                        <div className="grid grid-cols-1 gap-2">
                          {question.options.map((option, optionIndex) => (
                            <div key={option.optionNumber} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                              <input type="radio" name={`correct-${questionIndex}`} checked={option.isCorrect} onChange={() => {
                                const updatedOptions = question.options.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === optionIndex }));
                                updateDraftQuestion(questionIndex, { options: updatedOptions });
                              }} />
                              <input className="input-base flex-1" value={option.optionText} onChange={(e) => updateDraftOption(questionIndex, optionIndex, { optionText: e.target.value })} placeholder={`Option ${option.optionNumber}`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creatingManual}>Cancel</button>
                <button className="btn-primary" onClick={createManualTest} disabled={creatingManual}>
                  {creatingManual ? 'Creating...' : 'Create Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAiCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
              <h2 className="mb-2 text-xl font-semibold text-slate-900">Generate Quiz</h2>
              <p className="mb-4 text-sm text-slate-600">Choose AI source: syllabus topic/chapter context or uploaded PDF notes.</p>

              <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input
                    type="radio"
                    checked={aiSource === 'topic'}
                    onChange={() => setAiSource('topic')}
                  />
                  Generate from Topic/Chapter (AI)
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input
                    type="radio"
                    checked={aiSource === 'pdf'}
                    onChange={() => setAiSource('pdf')}
                  />
                  Generate from Uploaded PDF
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600 md:col-span-2">Standard/Class</label>
                <select className="input-base" value={aiForm.classId} onChange={(e) => setAiForm({ ...aiForm, classId: e.target.value, topicId: '' })}>
                  <option value="">Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name} - Grade {cls.grade} {cls.section}</option>
                  ))}
                </select>
                <select className="input-base" value={aiForm.subjectId} onChange={(e) => setAiForm({ ...aiForm, subjectId: e.target.value })}>
                  <option value="">Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>
                  ))}
                </select>

                {aiSource === 'topic' && (
                  <>
                    <select className="input-base md:col-span-2" value={aiForm.topicId} onChange={(e) => setAiForm({ ...aiForm, topicId: e.target.value })} disabled={!topics.length}>
                      <option value="">Select topic</option>
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>{topic.title}</option>
                      ))}
                    </select>
                    <input
                      className="input-base md:col-span-2"
                      placeholder="Or type chapter name (e.g., Chapter 3: Trigonometry)"
                      value={aiForm.chapterTitle}
                      onChange={(e) => setAiForm({ ...aiForm, chapterTitle: e.target.value })}
                    />
                    <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={aiForm.includePreviousTopics}
                        onChange={(e) => setAiForm({ ...aiForm, includePreviousTopics: e.target.checked })}
                      />
                      Include previous covered topics for better chapter context
                    </label>
                  </>
                )}

                <label className="text-sm text-slate-600 md:col-span-2">Question type pattern</label>
                <div className="md:col-span-2 grid grid-cols-2 gap-2">
                  <button type="button" className={`btn-secondary ${aiForm.questionMode === 'mcq' ? '!border-teal-500 !text-teal-700' : ''}`} onClick={() => setAiForm({ ...aiForm, questionMode: 'mcq' })}>MCQ Only</button>
                  <button type="button" className={`btn-secondary ${aiForm.questionMode === 'short_answer' ? '!border-teal-500 !text-teal-700' : ''}`} onClick={() => setAiForm({ ...aiForm, questionMode: 'short_answer' })}>Short Answer Only</button>
                  <button type="button" className={`btn-secondary ${aiForm.questionMode === 'long_answer' ? '!border-teal-500 !text-teal-700' : ''}`} onClick={() => setAiForm({ ...aiForm, questionMode: 'long_answer' })}>Long Answer Only</button>
                  <button type="button" className={`btn-secondary ${aiForm.questionMode === 'mix' ? '!border-teal-500 !text-teal-700' : ''}`} onClick={() => setAiForm({ ...aiForm, questionMode: 'mix' })}>Mix (MCQ + Short)</button>
                </div>

                <input className="input-base md:col-span-2" placeholder="Quiz title" value={aiForm.title} onChange={(e) => setAiForm({ ...aiForm, title: e.target.value })} />

                {aiSource === 'pdf' && (
                  <>
                    <input
                      className="input-base md:col-span-2"
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => void handlePdfUpload(event.target.files?.[0] || null)}
                    />
                    {pdfFileName ? <p className="md:col-span-2 text-sm text-slate-600">Selected file: {pdfFileName}</p> : null}
                  </>
                )}

                <input className="input-base" type="number" min={5} max={50} placeholder="Number of questions" value={aiForm.numQuestions} onChange={(e) => setAiForm({ ...aiForm, numQuestions: Number(e.target.value) })} />
                <select className="input-base" value={aiForm.difficulty} onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowAiCreate(false)} disabled={generatingAi}>Cancel</button>
                <button className="btn-primary" onClick={createAiTest} disabled={generatingAi}>
                  {generatingAi ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {reviewTest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Review AI Generated Test</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">{reviewTest.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">Please review the questions below. Make any necessary changes before publishing.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => {
                  setReviewTest(null);
                  setReviewQuestions([]);
                  setReviewStep('edit');
                }}>
                  Close
                </button>
              </div>

              <div className="mb-6 rounded-2xl bg-amber-50 p-4 border border-amber-200">
                <p className="text-sm font-semibold text-amber-900">📋 Review Checklist</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  <li>✓ Questions are relevant to the topic/chapter</li>
                  <li>✓ Multiple choice options are distinct and plausible</li>
                  <li>✓ No repeated concepts across questions</li>
                  <li>✓ Language is appropriate for the class level</li>
                  <li>✓ Correct answers are accurate</li>
                </ul>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Questions</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{reviewQuestions.length || reviewTest.total_questions || reviewTest.questions?.length || 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Difficulty</p>
                  <p className="mt-1 text-2xl font-bold capitalize text-slate-900">{reviewTest.difficulty || 'mixed'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Source</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{reviewTest.description?.includes('PDF') ? 'PDF Notes' : 'Syllabus'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-bold capitalize text-amber-700">{reviewTest.status || 'draft'}</p>
                </div>
              </div>

              <div className="mb-6">
                {reviewStep === 'edit' ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Question Editor</h3>
                      <button type="button" className="btn-secondary" onClick={addReviewQuestion}>Generate More (Add Blank)</button>
                    </div>
                    <div className="space-y-3">
                      {reviewQuestions.map((question: any, questionIndex: number) => (
                        <div key={question.id || questionIndex} className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {question.questionNumber}</p>
                            </div>
                            {reviewQuestions.length > 1 ? (
                              <button type="button" className="text-sm text-rose-600" onClick={() => removeReviewQuestion(questionIndex)}>Remove</button>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <textarea
                              className="input-base min-h-[90px]"
                              value={question.questionText}
                              onChange={(event) => updateReviewQuestion(questionIndex, { questionText: event.target.value })}
                              placeholder="Question text"
                            />
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                              <select className="input-base" value={question.questionType} onChange={(event) => updateReviewQuestion(questionIndex, { questionType: event.target.value as ReviewQuestion['questionType'] })}>
                                <option value="mcq">MCQ</option>
                                <option value="short_answer">Short Answer</option>
                                <option value="long_answer">Long Answer</option>
                                <option value="true_false">True / False</option>
                              </select>
                              <select className="input-base" value={question.difficulty} onChange={(event) => updateReviewQuestion(questionIndex, { difficulty: event.target.value as ReviewQuestion['difficulty'] })}>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                              <input className="input-base" type="number" min={1} value={question.points} onChange={(event) => updateReviewQuestion(questionIndex, { points: Number(event.target.value) })} />
                              <input className="input-base" value={question.correctAnswer} onChange={(event) => updateReviewQuestion(questionIndex, { correctAnswer: event.target.value })} placeholder="Correct answer" />
                            </div>

                            {question.questionType === 'mcq' ? (
                              <div className="grid gap-2">
                                {question.options.map((option: any, optionIndex: number) => (
                                  <div key={`${questionIndex}-${optionIndex}`} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                                    <input
                                      type="radio"
                                      name={`review-correct-${questionIndex}`}
                                      checked={option.isCorrect}
                                      onChange={() => {
                                        const updatedOptions = question.options.map((item: any, currentIndex: number) => ({
                                          ...item,
                                          isCorrect: currentIndex === optionIndex
                                        }));
                                        updateReviewQuestion(questionIndex, { options: updatedOptions });
                                      }}
                                    />
                                    <input
                                      className="input-base flex-1"
                                      value={option.optionText}
                                      onChange={(event) => updateReviewOption(questionIndex, optionIndex, { optionText: event.target.value })}
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <h3 className="text-lg font-semibold text-slate-900">Schedule Test Details</h3>
                    <p className="mt-1 text-sm text-slate-600">Set timing and rules before publishing this test to students.</p>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-600">Start Time</label>
                      <input className="input-base" type="datetime-local" value={reviewSchedule.startTime} onChange={(event) => setReviewSchedule({ ...reviewSchedule, startTime: event.target.value })} />
                      <label className="text-sm text-slate-600">End Time</label>
                      <input className="input-base" type="datetime-local" value={reviewSchedule.endTime} onChange={(event) => setReviewSchedule({ ...reviewSchedule, endTime: event.target.value })} />
                      <label className="text-sm text-slate-600">Duration (minutes)</label>
                      <input className="input-base" type="number" min={1} value={reviewSchedule.durationMinutes} onChange={(event) => setReviewSchedule({ ...reviewSchedule, durationMinutes: Number(event.target.value) })} />
                      <label className="text-sm text-slate-600">Passing Score</label>
                      <input className="input-base" type="number" min={0} value={reviewSchedule.passingScore} onChange={(event) => setReviewSchedule({ ...reviewSchedule, passingScore: Number(event.target.value) })} />
                      <label className="text-sm text-slate-600 md:col-span-2">Instructions</label>
                      <textarea className="input-base md:col-span-2 min-h-[90px]" value={reviewSchedule.instructions} onChange={(event) => setReviewSchedule({ ...reviewSchedule, instructions: event.target.value })} placeholder="Test instructions for students" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200 pt-6">
                <div className="rounded-2xl bg-teal-50 p-4">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                    <span className="text-sm font-medium text-teal-900">
                      {reviewStep === 'edit'
                        ? 'I have reviewed all questions and want to proceed to scheduling'
                        : 'I confirm the schedule and settings are correct for publishing'}
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  {reviewStep === 'schedule' ? (
                    <button type="button" className="btn-secondary" onClick={() => setReviewStep('edit')}>
                      Back to Questions
                    </button>
                  ) : (
                    <button type="button" className="btn-secondary" onClick={() => {
                      setReviewTest(null);
                      setReviewQuestions([]);
                      setReviewStep('edit');
                    }}>
                      Back to Edit
                    </button>
                  )}
                  {reviewStep === 'edit' ? (
                    <button type="button" className="btn-primary" onClick={proceedToSchedule}>
                      Proceed to Schedule
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" onClick={() => void publishReviewTest()} disabled={savingReview}>
                      {savingReview ? 'Saving & Publishing...' : 'Save Changes & Publish Test'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Tests;
