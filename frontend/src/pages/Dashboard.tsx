import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, classAPI, timetableAPI } from '../services/api';
import { Class, DashboardStats, Timetable } from '../types';
import { Users, BookOpen, Calendar, ClipboardCheck, ListTodo, ArrowUpRight, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

const toNumber = (value: unknown) => Number(value || 0);

const normalizeDashboardStats = (payload: any): DashboardStats => ({
  totalClasses: toNumber(payload.totalClasses ?? payload.total_classes),
  totalStudents: toNumber(payload.totalStudents ?? payload.total_students),
  todaysClasses: toNumber(payload.todaysClasses ?? payload.todays_classes ?? payload.today_classes),
  attendanceMarkedToday: toNumber(payload.attendanceMarkedToday ?? payload.attendance_marked_today ?? payload.records_today),
  enrolledClasses: toNumber(payload.enrolledClasses ?? payload.enrolled_classes),
  attendancePercentage: toNumber(payload.attendancePercentage ?? payload.attendance_percentage),
  averageGrade: toNumber(payload.averageGrade ?? payload.average_grade),
  totalTeachers: toNumber(payload.totalTeachers ?? payload.total_teachers)
});

type DashboardAttentionStudent = {
  id: number;
  classId: number;
  className: string;
  classGrade: string;
  classSection: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  overallPercentage: number;
  attendancePercentage: number;
  status: 'critical' | 'watchlist' | 'stable';
  reasons: string[];
};

type StudentLearningTopic = {
  subjectName: string;
  averagePercentage: number;
  totalAssessments: number;
};

type TopicVideoRecommendation = {
  title: string;
  videoId: string;
  recommendedFor: string;
};

type ProblemTypeKey = 'concept' | 'practice' | 'revision';

const STUDENT_LEARNING_THRESHOLD = 60;

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

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isStaff = user?.role === 'teacher' || user?.role === 'admin';
  const [stats, setStats] = useState<DashboardStats>({});
  const [todaysTimetable, setTodaysTimetable] = useState<Timetable[]>([]);
  const [attentionStudents, setAttentionStudents] = useState<DashboardAttentionStudent[]>([]);
  const [studentLearningTopics, setStudentLearningTopics] = useState<StudentLearningTopic[]>([]);
  const [activeVideo, setActiveVideo] = useState<{ title: string; videoId: string; subject: string; problemType: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await analyticsAPI.getDashboardStats();
      setStats(normalizeDashboardStats(statsRes.data));

      if (isStaff) {
        const [timetableRes, classesRes] = await Promise.all([
          timetableAPI.getByTeacher(user?.role === 'admin' ? undefined : user?.id),
          classAPI.getAll()
        ]);

        const today = new Date().getDay();
        const todaysSchedule = timetableRes.data.timetable.filter(
          (item: Timetable) => Number(item.dayOfWeek) === today
        );
        setTodaysTimetable(todaysSchedule);

        const classes: Class[] = classesRes.data.classes || [];
        const signalsResponses = await Promise.all(
          classes.map((cls) =>
            analyticsAPI
              .getClassInterventionSignals(cls.id, {
                lowThreshold: 50,
                highThreshold: 80,
                topicThreshold: 60,
                classThreshold: 65,
                attendanceThreshold: 75
              })
              .then((response) => ({ cls, data: response.data }))
              .catch(() => null)
          )
        );

        const mergedStudents = signalsResponses
          .filter((entry): entry is { cls: Class; data: any } => Boolean(entry))
          .flatMap(({ cls, data }) => {
            const rows = Array.isArray(data?.students) ? data.students : [];
            return rows
              .filter((student: any) => student.status === 'critical' || student.status === 'watchlist')
              .map((student: any) => ({
                id: Number(student.id),
                classId: Number(cls.id),
                className: cls.name,
                classGrade: cls.grade,
                classSection: cls.section,
                firstName: student.firstName ?? student.first_name ?? '',
                lastName: student.lastName ?? student.last_name ?? '',
                rollNumber: student.rollNumber ?? student.roll_number ?? '-',
                overallPercentage: Number(student.overallPercentage ?? student.overall_percentage ?? 0),
                attendancePercentage: Number(student.attendancePercentage ?? student.attendance_percentage ?? 0),
                status: (student.status ?? 'stable') as 'critical' | 'watchlist' | 'stable',
                reasons: Array.isArray(student.reasons) ? student.reasons : []
              }));
          })
          .sort((a, b) => {
            if (a.status !== b.status) {
              return a.status === 'critical' ? -1 : 1;
            }
            return a.overallPercentage - b.overallPercentage;
          })
          .slice(0, 6);

        setAttentionStudents(mergedStudents);
      }

      if (user?.role === 'student' && user?.id) {
        const studentAnalyticsRes = await analyticsAPI.getStudentAnalytics(user.id);
        const subjectRows = Array.isArray(studentAnalyticsRes.data?.subjectWisePerformance)
          ? studentAnalyticsRes.data.subjectWisePerformance
          : [];

        const weakRows = subjectRows
          .map((row: any) => ({
            subjectName: row.subjectName ?? row.subject_name ?? '-',
            averagePercentage: Number(row.averagePercentage ?? row.average_percentage ?? 0),
            totalAssessments: Number(row.totalAssessments ?? row.total_assessments ?? 0)
          }))
          .filter((row: StudentLearningTopic) => row.averagePercentage < STUDENT_LEARNING_THRESHOLD)
          .sort((a: StudentLearningTopic, b: StudentLearningTopic) => a.averagePercentage - b.averagePercentage)
          .slice(0, 4);

        setStudentLearningTopics(weakRows);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  if (loading) {
    return (
      <Layout>
        <LoadingState message="Preparing your dashboard..." />
      </Layout>
    );
  }

  const teacherTasks = [
    {
      label: 'Attendance to mark',
      value: Math.max((stats.todaysClasses || 0) - (stats.attendanceMarkedToday || 0), 0),
      href: '/attendance'
    },
    {
      label: 'Classes today',
      value: stats.todaysClasses || 0,
      href: '/timetable'
    },
    {
      label: 'Recent grading workload',
      value: Math.max(Math.round((stats.totalStudents || 0) * 0.35), 0),
      href: '/grades'
    }
  ];

  const attendanceGap = Math.max((stats.todaysClasses || 0) - (stats.attendanceMarkedToday || 0), 0);
  const workflowSteps = [
    {
      id: 'attendance',
      label: 'Mark attendance for all classes',
      done: attendanceGap === 0,
      hint: attendanceGap === 0 ? 'Done for today' : `${attendanceGap} classes pending`,
      href: '/attendance'
    },
    {
      id: 'grading',
      label: 'Complete key grading updates',
      done: (stats.averageGrade || 0) > 0,
      hint: (stats.averageGrade || 0) > 0 ? `Current class avg ${Math.round(stats.averageGrade || 0)}%` : 'No grading trend yet',
      href: '/grades'
    },
    {
      id: 'intervention',
      label: 'Review intervention candidates',
      done: attentionStudents.length === 0,
      hint: attentionStudents.length === 0 ? 'No at-risk alerts' : `${attentionStudents.length} students need attention`,
      href: '/analytics'
    }
  ];
  const completedWorkflowSteps = workflowSteps.filter((step) => step.done).length;
  const workflowProgress = Math.round((completedWorkflowSteps / workflowSteps.length) * 100);

  return (
    <Layout>
      <div>
        <PageHeader
          title={`Welcome back, ${user?.firstName || 'Teacher'}`}
          description="Today’s overview and your next high-impact actions"
          actions={
            isStaff ? (
              <>
                <Link to="/attendance" className="btn-secondary">Quick Attendance</Link>
                <Link to="/grades" className="btn-primary">Open Gradebook</Link>
              </>
            ) : null
          }
        />

        {isStaff && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="soft-card stat-strip p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">My Classes</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {stats.totalClasses || 0}
                  </p>
                </div>
                <div className="rounded-full bg-sky-100 p-3">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="soft-card stat-strip p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Students</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {stats.totalStudents || 0}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-100 p-3">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="soft-card stat-strip p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Today's Classes</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {stats.todaysClasses || 0}
                  </p>
                </div>
                <div className="rounded-full bg-amber-100 p-3">
                  <Calendar className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="soft-card stat-strip p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Attendance Today</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {stats.attendanceMarkedToday || 0}
                  </p>
                </div>
                <div className="rounded-full bg-indigo-100 p-3">
                  <ClipboardCheck className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {isStaff && (
          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="soft-card xl:col-span-2 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  Today’s Overview • {getDayName(new Date().getDay())}
                </h2>
                <Link to="/timetable" className="premium-pill">View Week</Link>
              </div>
              <div className="p-6">
                {todaysTimetable.length > 0 ? (
                  <div className="space-y-3">
                    {todaysTimetable.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg md:flex-row md:items-center"
                      >
                        <div>
                          <h3 className="font-semibold text-slate-900">{item.subjectName}</h3>
                          <p className="text-sm text-slate-600">
                            {item.className} • Grade {item.grade} {item.section}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="font-medium text-slate-900">{item.startTime} - {item.endTime}</p>
                          {item.roomNumber ? <p className="text-sm text-slate-600">Room {item.roomNumber}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No classes scheduled for today"
                    description="Use the timetable section to plan your next classes."
                  />
                )}
              </div>
            </div>

            <div className="soft-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-teal-700" />
                <h2 className="text-lg font-semibold text-slate-900">Pending Tasks</h2>
              </div>
              <div className="space-y-3">
                {teacherTasks.map((task) => (
                  <Link
                    key={task.label}
                    to={task.href}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:shadow-sm"
                  >
                    <div>
                      <p className="text-sm text-slate-600">{task.label}</p>
                      <p className="text-xl font-bold text-slate-900">{task.value}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  </Link>
                ))}
                <div className="rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-800">
                  Tip: mark attendance right after each session to keep analytics accurate.
                </div>
              </div>
            </div>
          </div>
        )}

        {isStaff && (
          <div className="mb-8 soft-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Teacher Workflow Assistant</h2>
                <p className="text-sm text-slate-600">Daily step-by-step workflow to reduce admin load and keep data complete.</p>
              </div>
              <span className="premium-pill">{workflowProgress}% complete</span>
            </div>

            <div className="mb-4 h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${workflowProgress}%` }} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {workflowSteps.map((step) => (
                <Link
                  key={step.id}
                  to={step.href}
                  className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                    step.done
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{step.hint}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isStaff && (
          <div className="mb-8 soft-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-700" />
                <h2 className="text-lg font-semibold text-slate-900">Students Needing Attention</h2>
              </div>
              <Link to="/analytics" className="premium-pill">Open Full Analytics</Link>
            </div>

            {attentionStudents.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                Great work. No critical or watchlist students detected with the current thresholds.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {attentionStudents.map((student) => (
                  <div key={`${student.classId}-${student.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {student.firstName} {student.lastName} ({student.rollNumber})
                        </p>
                        <p className="text-sm text-slate-600">
                          {student.className} • Grade {student.classGrade} {student.classSection}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Overall {Math.round(student.overallPercentage)}% • Attendance {Math.round(student.attendancePercentage)}%
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${student.status === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {student.status}
                      </span>
                    </div>
                    {student.reasons.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">{student.reasons.join(' • ')}</p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
                      <Link to={`/students/${student.id}`} className="text-teal-700 hover:text-teal-800 hover:underline">Open Profile</Link>
                      <Link to="/analytics" className="text-slate-600 hover:text-slate-800 hover:underline">View Class Signals</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {user?.role === 'student' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="soft-card stat-strip p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Enrolled Classes</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {stats.enrolledClasses || 0}
                    </p>
                  </div>
                  <div className="rounded-full bg-sky-100 p-3">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="soft-card stat-strip p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Attendance</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {Math.round(stats.attendancePercentage || 0)}%
                    </p>
                  </div>
                  <div className="rounded-full bg-emerald-100 p-3">
                    <ClipboardCheck className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="soft-card stat-strip p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Average Grade</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {Math.round(stats.averageGrade || 0)}%
                    </p>
                  </div>
                  <div className="rounded-full bg-indigo-100 p-3">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 soft-card p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Personal Learning Plan</h2>
                  <p className="text-sm text-slate-600">Focused in-portal study actions for your weaker subjects.</p>
                </div>
                <span className="premium-pill">
                  Below {STUDENT_LEARNING_THRESHOLD}%
                </span>
              </div>

              {studentLearningTopics.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Great progress. No weak subjects detected right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {studentLearningTopics.map((topic) => (
                    <div key={topic.subjectName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                      <p className="font-semibold text-slate-900">{topic.subjectName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Current average: {Math.round(topic.averagePercentage)}% • Assessments: {topic.totalAssessments}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
                        <Link to="/syllabus" className="inline-flex items-center rounded-lg bg-brand-600 px-3 py-1.5 text-white transition hover:bg-brand-700">
                          Study Syllabus
                        </Link>
                        <Link to="/tests" className="inline-flex items-center rounded-lg bg-slate-800 px-3 py-1.5 text-white transition hover:bg-slate-900">
                          Practice Test
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 soft-card p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Recommended Video Lessons (In Portal)</h2>
                <p className="text-sm text-slate-600">
                  Videos are selected by weak subject and problem type, and play directly inside the portal.
                </p>
              </div>

              {studentLearningTopics.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  No weak subjects detected right now, so no mandatory video recommendations.
                </div>
              ) : (
                <div className="space-y-6">
                  {studentLearningTopics.map((topic) => {
                    const problem = getProblemType(topic.averagePercentage);
                    const recommendations = getVideoRecommendationsForTopic(topic.subjectName, problem.key);

                    return (
                      <div key={`video-${topic.subjectName}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{topic.subjectName}</p>
                            <p className="text-sm text-slate-600">
                              Problem: {problem.label} • Current average: {Math.round(topic.averagePercentage)}%
                            </p>
                          </div>
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            Needs improvement
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {recommendations.map((video) => (
                            <div key={`${topic.subjectName}-${video.videoId}-${video.title}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
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
                                  className="h-44 w-full object-cover transition duration-200 group-hover:scale-[1.02] sm:h-56"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/25 opacity-100 transition group-hover:bg-slate-900/35">
                                  <span className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
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
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
                <div className="my-4 w-full max-w-4xl rounded-2xl bg-white p-3 shadow-lifted sm:my-0 sm:rounded-[1.75rem] sm:p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                      className="h-[220px] w-full sm:h-[320px] lg:h-[420px]"
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&rel=0`}
                      title={`Video player: ${activeVideo.title}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}


      </div>
    </Layout>
  );
};

export default Dashboard;
