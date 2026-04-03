import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { studentAPI, gradeAPI, attendanceAPI, analyticsAPI } from '../services/api';
import { Student, Grade } from '../types';

const LEARNING_TOPIC_THRESHOLD = 60;

type TopicVideoRecommendation = {
  title: string;
  videoId: string;
  recommendedFor: string;
};

type ProblemTypeKey = 'concept' | 'practice' | 'revision';

const SUBJECT_VIDEO_LIBRARY: Array<{
  pattern: RegExp;
  recommendations: Record<ProblemTypeKey, TopicVideoRecommendation[]>;
}> = [
  {
    pattern: /(math|mathematics|algebra|geometry|trigonometry)/i,
    recommendations: {
      concept: [
        { title: 'Algebra Basics and Equation Solving', videoId: 'M7lc1UVf-VE', recommendedFor: 'Concept foundation in algebra' },
        { title: 'Understanding Variables and Equations', videoId: 'ysz5S6PUM-U', recommendedFor: 'Core equation concepts' }
      ],
      practice: [
        { title: 'Solving Equation Practice Walkthrough', videoId: 'M7lc1UVf-VE', recommendedFor: 'Practice accuracy improvement' },
        { title: 'Common Math Mistakes and Fixes', videoId: 'ysz5S6PUM-U', recommendedFor: 'Reducing step-by-step errors' }
      ],
      revision: [
        { title: 'Math Revision Sprint: Key Rules', videoId: 'M7lc1UVf-VE', recommendedFor: 'Fast concept revision before tests' },
        { title: 'Quick Formula Revision Session', videoId: 'ysz5S6PUM-U', recommendedFor: 'Formula recall and retention' }
      ]
    }
  },
  {
    pattern: /(science|physics|chemistry|biology)/i,
    recommendations: {
      concept: [
        { title: 'Science Concepts Explained Simply', videoId: 'M7lc1UVf-VE', recommendedFor: 'Concept foundation in science' },
        { title: 'Core Physics and Chemistry Principles', videoId: 'ysz5S6PUM-U', recommendedFor: 'Understanding basic principles' }
      ],
      practice: [
        { title: 'Science Problem Solving Practice', videoId: 'M7lc1UVf-VE', recommendedFor: 'Practice accuracy in applied questions' },
        { title: 'How to Approach Numerical Questions', videoId: 'ysz5S6PUM-U', recommendedFor: 'Structured solving approach' }
      ],
      revision: [
        { title: 'Science Revision: Important Topics', videoId: 'M7lc1UVf-VE', recommendedFor: 'High-yield topic revision' },
        { title: 'Exam Revision for Physics and Chemistry', videoId: 'ysz5S6PUM-U', recommendedFor: 'Pre-exam recap' }
      ]
    }
  },
  {
    pattern: /(english|language|grammar|literature)/i,
    recommendations: {
      concept: [
        { title: 'English Grammar Basics', videoId: 'M7lc1UVf-VE', recommendedFor: 'Grammar concept clarity' },
        { title: 'Sentence Structure Fundamentals', videoId: 'ysz5S6PUM-U', recommendedFor: 'Core language structure understanding' }
      ],
      practice: [
        { title: 'Reading Comprehension Practice', videoId: 'M7lc1UVf-VE', recommendedFor: 'Answer accuracy in comprehension' },
        { title: 'Grammar Error Correction Practice', videoId: 'ysz5S6PUM-U', recommendedFor: 'Frequent grammar mistakes' }
      ],
      revision: [
        { title: 'English Revision: Key Grammar Rules', videoId: 'M7lc1UVf-VE', recommendedFor: 'Quick grammar revision' },
        { title: 'Vocabulary and Comprehension Revision', videoId: 'ysz5S6PUM-U', recommendedFor: 'Revision before assessments' }
      ]
    }
  },
  {
    pattern: /(history|civics|geography|social)/i,
    recommendations: {
      concept: [
        { title: 'History and Civics Core Concepts', videoId: 'M7lc1UVf-VE', recommendedFor: 'Concept foundation in social studies' },
        { title: 'Geography Basics and Map Understanding', videoId: 'ysz5S6PUM-U', recommendedFor: 'Core geography understanding' }
      ],
      practice: [
        { title: 'Social Studies Answer Writing Practice', videoId: 'M7lc1UVf-VE', recommendedFor: 'Answer structure and accuracy' },
        { title: 'Map-Based Question Practice', videoId: 'ysz5S6PUM-U', recommendedFor: 'Applied geography practice' }
      ],
      revision: [
        { title: 'History Revision in 20 Minutes', videoId: 'M7lc1UVf-VE', recommendedFor: 'Timeline and event revision' },
        { title: 'Quick Civics and Geography Revision', videoId: 'ysz5S6PUM-U', recommendedFor: 'Last-mile exam preparation' }
      ]
    }
  }
];

const getProblemType = (averagePercentage: number): { key: ProblemTypeKey; label: string } => {
  if (averagePercentage < 40) return { key: 'concept', label: 'Concept foundation gap' };
  if (averagePercentage < 50) return { key: 'practice', label: 'Practice accuracy gap' };
  return { key: 'revision', label: 'Revision needed' };
};

const getVideoRecommendationsForTopic = (subjectName: string, problemKey: ProblemTypeKey): TopicVideoRecommendation[] => {
  const matched = SUBJECT_VIDEO_LIBRARY.find((entry) => entry.pattern.test(subjectName));
  if (matched) return matched.recommendations[problemKey];
  return [
    { title: 'Study Skills and Learning Strategy', videoId: 'M7lc1UVf-VE', recommendedFor: 'General study planning support' },
    { title: 'How to Learn Difficult Topics Faster', videoId: 'ysz5S6PUM-U', recommendedFor: 'General learning speed and retention' }
  ];
};

const getThumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const StudentDetail: React.FC = () => {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ title: string; videoId: string; subject: string; problemType: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const studentRes = await studentAPI.getById(Number(id));
        const studentData = studentRes.data.student;
        setStudent(studentData);

        const [gradesRes, attendanceRes, analyticsRes] = await Promise.all([
          gradeAPI.getByStudent(Number(id)),
          attendanceAPI.getByStudent(Number(id)),
          analyticsAPI.getStudentAnalytics(Number(id))
        ]);

        setGrades(gradesRes.data.grades || []);
        setAttendanceStats(attendanceRes.data.statistics || null);
        setAnalytics(analyticsRes.data || null);
      } catch {
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [id]);

  if (loading) {
    return <Layout><LoadingState message="Loading student profile..." /></Layout>;
  }

  if (!student) {
    return <Layout><EmptyState title="Student not found" description="The selected student profile could not be loaded." /></Layout>;
  }

  const subjectPerformance = Array.isArray(analytics?.subjectWisePerformance)
    ? analytics.subjectWisePerformance
    : [];

  const weakTopics = subjectPerformance
    .map((item: any) => ({
      subjectName: item.subjectName ?? item.subject_name ?? '-',
      averagePercentage: Number(item.averagePercentage ?? item.average_percentage ?? 0),
      totalAssessments: Number(item.totalAssessments ?? item.total_assessments ?? 0)
    }))
    .filter((item: any) => item.averagePercentage < LEARNING_TOPIC_THRESHOLD)
    .sort((a: any, b: any) => a.averagePercentage - b.averagePercentage)
    .slice(0, 4);

  return (
    <Layout>
      <div>
        <PageHeader
          title={`${student.firstName} ${student.lastName}`}
          description={`Roll ${student.rollNumber || '-'} • ${student.className || 'No class'} ${student.grade || ''}${student.section ? ` ${student.section}` : ''}`}
          actions={<Link to="/students" className="btn-secondary">Back to Students</Link>}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Profile</h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Email:</span> {student.email}</p>
              <p><span className="font-semibold">Phone:</span> {student.phone || '-'}</p>
              <p><span className="font-semibold">Roll No:</span> {student.rollNumber || '-'}</p>
              <p><span className="font-semibold">Class:</span> {student.className || '-'} {student.grade ? `- Grade ${student.grade}` : ''} {student.section || ''}</p>
              <p><span className="font-semibold">Enrollment:</span> {student.enrollmentStatus || '-'}</p>
            </div>
          </div>

          <div className="card p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Academic Snapshot</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Attendance</p>
                <p className="text-2xl font-bold text-emerald-800">{Math.round(Number(analytics?.attendanceStats?.attendancePercentage || attendanceStats?.attendancePercentage || 0))}%</p>
              </div>
              <div className="rounded-xl bg-sky-50 p-4">
                <p className="text-xs uppercase tracking-wide text-sky-700">Recent Grades</p>
                <p className="text-2xl font-bold text-sky-800">{grades.length}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Avg Score</p>
                <p className="text-2xl font-bold text-amber-800">{Math.round(Number(analytics?.overallPerformance?.averagePercentage || 0))}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Attendance Summary</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p>Total days: {attendanceStats?.totalDays || 0}</p>
              <p>Present: {attendanceStats?.presentDays || 0}</p>
              <p>Absent: {attendanceStats?.absentDays || 0}</p>
              <p>Late: {attendanceStats?.lateDays || 0}</p>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Latest Grades</h3>
            <div className="space-y-3">
              {grades.slice(0, 5).map((grade) => (
                <div key={grade.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{grade.subjectName || '-'}</p>
                    <p className="text-sm text-slate-500">{grade.examTypeName || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{grade.marksObtained}/{grade.maxMarks}</p>
                    <p className="text-xs text-slate-500">{grade.grade}</p>
                  </div>
                </div>
              ))}
              {grades.length === 0 && <p className="text-sm text-slate-500">No grades yet.</p>}
            </div>
          </div>
        </div>

        <div className="mt-6 card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Self-Learning Plan (In Portal)</h3>
              <p className="text-sm text-slate-600">
                Personalized recommendations for weaker subjects with direct actions inside this portal.
              </p>
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              Threshold: below {LEARNING_TOPIC_THRESHOLD}%
            </span>
          </div>

          {weakTopics.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              No weak topics detected from current data. Keep practicing to maintain progress.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {weakTopics.map((topic: any) => (
                <div key={topic.subjectName} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{topic.subjectName}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Current average: {Math.round(topic.averagePercentage)}% • Assessments: {topic.totalAssessments}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
                    <Link to="/syllabus" className="inline-flex items-center rounded-lg bg-teal-600 px-3 py-1.5 text-white transition hover:bg-teal-700">
                      Open Syllabus
                    </Link>
                    <Link to="/tests" className="inline-flex items-center rounded-lg bg-slate-700 px-3 py-1.5 text-white transition hover:bg-slate-800">
                      Practice Tests
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Teacher Recommended Video Lessons (In Portal)</h3>
              <p className="text-sm text-slate-600">
                Subject and problem-based recommendations that play directly in this portal.
              </p>
            </div>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              Based on weak topics
            </span>
          </div>

          {weakTopics.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              No weak topics detected, so no urgent teacher-recommended videos right now.
            </div>
          ) : (
            <div className="space-y-6">
              {weakTopics.map((topic: any) => {
                const problem = getProblemType(topic.averagePercentage);
                const recommendations = getVideoRecommendationsForTopic(topic.subjectName, problem.key);

                return (
                  <div key={`teacher-video-${topic.subjectName}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{topic.subjectName}</p>
                        <p className="text-sm text-slate-600">
                          Problem: {problem.label} • Current average: {Math.round(topic.averagePercentage)}%
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        Teacher recommendation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {recommendations.map((video) => (
                        <div key={`${topic.subjectName}-${video.videoId}-${video.title}`} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-sm font-semibold text-slate-800">{video.title}</p>
                          <p className="mb-2 text-xs text-slate-500">Recommended for: {video.recommendedFor}</p>
                          <button
                            type="button"
                            onClick={() => setActiveVideo({ title: video.title, videoId: video.videoId, subject: topic.subjectName, problemType: problem.label })}
                            className="group relative w-full overflow-hidden rounded-lg border border-slate-200"
                          >
                            <img
                              src={getThumbnailUrl(video.videoId)}
                              alt={`${video.title} thumbnail`}
                              className="h-56 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/35 opacity-100 transition group-hover:bg-slate-900/45">
                              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900">
                                Play Video
                              </span>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {activeVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{activeVideo.title}</h3>
                  <p className="text-sm text-slate-600">{activeVideo.subject} • {activeVideo.problemType}</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setActiveVideo(null)}>
                  Close
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <iframe
                  className="h-[420px] w-full"
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&rel=0`}
                  title={`Video player: ${activeVideo.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StudentDetail;
