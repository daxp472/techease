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
  points?: number;
  options?: OptionItem[];
}

const TestAttempt: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [test, setTest] = useState<{ id: number; title: string; description?: string; duration_minutes?: number; questions?: TestQuestionItem[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});

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
          ? progressResponse.data.answers.reduce((acc: Record<number, string | number>, item: any) => {
              if (item?.questionId !== undefined) {
                acc[Number(item.questionId)] = item.answer ?? '';
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
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id ?? option.optionNumber ?? option.optionText}
                          checked={String(answers[question.id] ?? '') === String(option.id ?? option.optionNumber ?? option.optionText)}
                          onChange={() => setAnswers({ ...answers, [question.id]: option.id ?? option.optionNumber ?? option.optionText })}
                        />
                        <span className="text-sm text-slate-800">{option.optionText}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="input-base min-h-[120px]"
                    placeholder="Type your answer here"
                    value={answers[question.id] || ''}
                    onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn-primary" onClick={submitAttempt} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Test'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TestAttempt;
