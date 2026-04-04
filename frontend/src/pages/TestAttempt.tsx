import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { testAPI } from '../services/api';
import { useToast } from '../components/ui/ToastContext';

interface OptionItem {
  id?: number;
  optionNumber?: number;
  optionText: string;
  isCorrect?: boolean;
}

interface TestQuestionItem {
  id: number;
  questionNumber: number;
  questionText: string;
  questionType: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
  allowsMultiple?: boolean;
  points?: number;
  options?: OptionItem[];
}

const parseStoredAnswer = (value: any): string | number | number[] => {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item));
      }
    } catch {
      return text;
    }
  }

  return text;
};

const TestAttempt: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [test, setTest] = useState<{ id: number; title: string; description?: string; duration_minutes?: number; questions?: TestQuestionItem[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | number | number[]>>({});
  const [reportingQuestion, setReportingQuestion] = useState<TestQuestionItem | null>(null);
  const [reportIssueType, setReportIssueType] = useState('incorrect_answer');
  const [reportComment, setReportComment] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const fetchTest = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [response, progressResponse] = await Promise.all([
          testAPI.getById(Number(id)),
          testAPI.getProgress(Number(id))
        ]);
        const raw = response.data.test;
        const normalizedQuestions = (raw.questions || []).map((question: any) => ({
          id: Number(question.id),
          questionNumber: Number(question.questionNumber ?? question.question_number),
          questionText: question.questionText ?? question.question_text ?? '',
          questionType: question.questionType ?? question.question_type,
          allowsMultiple: Boolean(question.allowsMultiple ?? question.allows_multiple),
          points: Number(question.points ?? 1),
          options: Array.isArray(question.options)
            ? question.options.filter((option: any) => option && (option.optionText ?? option.option_text)).map((option: any) => ({
                id: option.id,
                optionNumber: option.optionNumber ?? option.option_number,
                optionText: option.optionText ?? option.option_text,
                isCorrect: option.isCorrect
              }))
            : []
        }));

        setTest({
          ...raw,
          questions: normalizedQuestions
        });

        const savedAnswers = Array.isArray(progressResponse.data?.answers)
          ? progressResponse.data.answers.reduce((acc: Record<number, string | number | number[]>, item: any) => {
              if (item?.questionId !== undefined) {
                acc[Number(item.questionId)] = parseStoredAnswer(item.answer);
              }
              return acc;
            }, {})
          : {};

        setAnswers(savedAnswers);
      } catch {
        setTest(null);
        showToast('Unable to load test', 'error');
      } finally {
        setLoading(false);
      }
    };

    void fetchTest();
  }, [id, showToast]);

  const questions = useMemo(() => test?.questions || [], [test]);

  const submitAttempt = async () => {
    if (!id) return;

    const hasUnanswered = questions.some((question) => {
      const answer = answers[question.id];
      if (Array.isArray(answer)) {
        return answer.length === 0;
      }
      return answer === undefined || answer === null || String(answer).trim() === '';
    });

    if (hasUnanswered) {
      showToast('Please answer all questions before submitting.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await testAPI.submit(Number(id), {
        testId: Number(id),
        answers: questions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? ''
        }))
      });
      showToast('Test submitted successfully', 'success');
      navigate('/student/tests');
    } catch {
      showToast('Unable to submit test', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMultiSelectAnswer = (questionId: number, optionValue: number) => {
    const existing = Array.isArray(answers[questionId]) ? answers[questionId] as number[] : [];
    const next = existing.includes(optionValue)
      ? existing.filter((value) => value !== optionValue)
      : [...existing, optionValue];

    setAnswers({ ...answers, [questionId]: next });
  };

  const submitQuestionReport = async () => {
    if (!id || !reportingQuestion) {
      return;
    }

    setReporting(true);
    try {
      await testAPI.reportQuestionIssue(Number(id), reportingQuestion.id, {
        issueType: reportIssueType,
        comment: reportComment.trim() || undefined
      });
      showToast('Question has been flagged for teacher review.', 'success');
      setReportingQuestion(null);
      setReportIssueType('incorrect_answer');
      setReportComment('');
    } catch {
      showToast('Unable to report this question right now.', 'error');
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return <Layout><LoadingState message="Loading test..." /></Layout>;
  }

  if (!test) {
    return <Layout><EmptyState title="Test not found" description="This test may no longer be available." /></Layout>;
  }

  return (
    <Layout>
      <div>
        <PageHeader title={test.title} description={test.description || 'Answer each question and submit before time ends.'} />

        <div className="card p-6">
          <div className="space-y-6">
            {questions.map((question) => (
              <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Question {question.questionNumber}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{question.questionText}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 capitalize">
                    {question.questionType}
                  </span>
                </div>

                {question.questionType === 'mcq' && Array.isArray(question.options) ? (
                  <div className="space-y-2">
                    {question.options.map((option, index) => (
                      <label key={option.id || option.optionNumber || index} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50">
                        <input
                          type={question.allowsMultiple ? 'checkbox' : 'radio'}
                          name={`question-${question.id}`}
                          value={option.id ?? option.optionNumber ?? option.optionText}
                          checked={question.allowsMultiple
                            ? Array.isArray(answers[question.id]) && (answers[question.id] as number[]).includes(Number(option.id ?? option.optionNumber))
                            : String(answers[question.id] ?? '') === String(option.id ?? option.optionNumber ?? option.optionText)}
                          onChange={() => {
                            const answerValue = Number(option.id ?? option.optionNumber ?? 0);
                            if (question.allowsMultiple) {
                              if (Number.isFinite(answerValue) && answerValue > 0) {
                                toggleMultiSelectAnswer(question.id, answerValue);
                              }
                              return;
                            }

                            setAnswers({ ...answers, [question.id]: option.id ?? option.optionNumber ?? option.optionText });
                          }}
                        />
                        <span className="text-sm text-slate-800">{option.optionText}</span>
                      </label>
                    ))}
                    {question.allowsMultiple ? (
                      <p className="text-xs text-slate-500">This question has multiple correct options. Select all that apply.</p>
                    ) : null}
                  </div>
                ) : (
                  <textarea
                    className="input-base min-h-[120px]"
                    placeholder="Type your answer here"
                    value={(() => {
                      const currentAnswer = answers[question.id];
                      return Array.isArray(currentAnswer) ? '' : (currentAnswer ?? '');
                    })()}
                    onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
                  />
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setReportingQuestion(question);
                      setReportIssueType('incorrect_answer');
                      setReportComment('');
                    }}
                  >
                    Report Question Issue
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn-primary" onClick={submitAttempt} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Test'}
            </button>
          </div>
        </div>

        {reportingQuestion ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Report Question</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">Question {reportingQuestion.questionNumber}</h3>
                  <p className="mt-1 text-sm text-slate-600">Tell your teacher what looks wrong so they can review it.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setReportingQuestion(null)}>Close</button>
              </div>

              <div className="mt-4 space-y-3">
                <select className="input-base" value={reportIssueType} onChange={(event) => setReportIssueType(event.target.value)}>
                  <option value="incorrect_answer">Correct answer is wrong</option>
                  <option value="wrong_question">Question is wrong</option>
                  <option value="option_issue">Options are wrong/confusing</option>
                  <option value="unclear">Question is unclear</option>
                  <option value="typo">Typo/grammar issue</option>
                  <option value="other">Other issue</option>
                </select>
                <textarea
                  className="input-base min-h-[120px]"
                  placeholder="Optional note for your teacher"
                  value={reportComment}
                  onChange={(event) => setReportComment(event.target.value)}
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setReportingQuestion(null)} disabled={reporting}>Cancel</button>
                <button type="button" className="btn-primary" onClick={() => void submitQuestionReport()} disabled={reporting}>
                  {reporting ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default TestAttempt;
