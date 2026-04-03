import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { analyticsAPI, classAPI } from '../services/api';
import { ClassAnalytics, Class } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const normalizeAnalytics = (payload: any) => ({
  attendanceStats: {
    totalStudents: Number(payload.attendanceStats?.totalStudents ?? payload.attendanceStats?.total_students ?? 0),
    totalAttendanceRecords: Number(payload.attendanceStats?.totalAttendanceRecords ?? payload.attendanceStats?.total_attendance_records ?? 0),
    totalPresent: Number(payload.attendanceStats?.totalPresent ?? payload.attendanceStats?.total_present ?? 0),
    totalAbsent: Number(payload.attendanceStats?.totalAbsent ?? payload.attendanceStats?.total_absent ?? 0),
    attendancePercentage: Number(payload.attendanceStats?.attendancePercentage ?? payload.attendanceStats?.attendance_percentage ?? 0)
  },
  gradeDistribution: (payload.gradeDistribution || []).map((row: any) => ({
    grade: row.grade,
    count: Number(row.count ?? 0)
  })),
  subjectWisePerformance: (payload.subjectWisePerformance || []).map((row: any) => ({
    subjectName: row.subjectName ?? row.subject_name,
    averagePercentage: Number(row.averagePercentage ?? row.average_percentage ?? 0),
    totalAssessments: Number(row.totalAssessments ?? row.total_assessments ?? 0)
  })),
  topPerformers: (payload.topPerformers || []).map((row: any) => ({
    id: Number(row.id),
    firstName: row.firstName ?? row.first_name,
    lastName: row.lastName ?? row.last_name,
    rollNumber: row.rollNumber ?? row.roll_number,
    averagePercentage: Number(row.averagePercentage ?? row.average_percentage ?? 0)
  })),
  weakStudents: (payload.weakStudents || []).map((row: any) => ({
    id: Number(row.id),
    firstName: row.firstName ?? row.first_name,
    lastName: row.lastName ?? row.last_name,
    rollNumber: row.rollNumber ?? row.roll_number,
    averagePercentage: Number(row.averagePercentage ?? row.average_percentage ?? 0),
    totalAssessments: Number(row.totalAssessments ?? row.total_assessments ?? 0),
    attendancePercentage: Number(row.attendancePercentage ?? row.attendance_percentage ?? 0)
  })),
  monthlyTrend: (payload.monthlyTrend || []).map((row: any) => ({
    month: row.month,
    average_percentage: Number(row.average_percentage ?? row.averagePercentage ?? 0)
  })),
  testPerformance: (payload.testPerformance || []).map((row: any) => ({
    id: Number(row.id),
    title: row.title ?? '',
    status: row.status ?? 'draft',
    testType: row.testType ?? row.test_type ?? 'manual',
    totalQuestions: Number(row.totalQuestions ?? row.total_questions ?? 0),
    totalSubmissions: Number(row.totalSubmissions ?? row.total_submissions ?? 0),
    gradedSubmissions: Number(row.gradedSubmissions ?? row.graded_submissions ?? 0),
    averagePercentage: Number(row.averagePercentage ?? row.average_percentage ?? 0),
    minPercentage: Number(row.minPercentage ?? row.min_percentage ?? 0),
    maxPercentage: Number(row.maxPercentage ?? row.max_percentage ?? 0),
    startTime: row.startTime ?? row.start_time ?? null,
    endTime: row.endTime ?? row.end_time ?? null
  })),
  testStats: {
    totalTests: Number(payload.testStats?.total_tests ?? payload.testStats?.totalTests ?? 0),
    scheduledTests: Number(payload.testStats?.scheduled_tests ?? payload.testStats?.scheduledTests ?? 0),
    activeTests: Number(payload.testStats?.active_tests ?? payload.testStats?.activeTests ?? 0),
    completedTests: Number(payload.testStats?.completed_tests ?? payload.testStats?.completedTests ?? 0),
    studentsWithResults: Number(payload.testStats?.students_with_results ?? payload.testStats?.studentsWithResults ?? 0),
    gradedSubmissions: Number(payload.testStats?.graded_submissions ?? payload.testStats?.gradedSubmissions ?? 0)
  }
});

const normalizeInterventionSignals = (payload: any) => ({
  thresholds: {
    lowThreshold: Number(payload.thresholds?.lowThreshold ?? 50),
    highThreshold: Number(payload.thresholds?.highThreshold ?? 80),
    topicThreshold: Number(payload.thresholds?.topicThreshold ?? 60),
    classThreshold: Number(payload.thresholds?.classThreshold ?? 65),
    attendanceThreshold: Number(payload.thresholds?.attendanceThreshold ?? 75)
  },
  classSummary: {
    totalStudents: Number(payload.classSummary?.totalStudents ?? 0),
    classAverage: Number(payload.classSummary?.classAverage ?? 0),
    classNeedsIntervention: Boolean(payload.classSummary?.classNeedsIntervention),
    criticalCount: Number(payload.classSummary?.criticalCount ?? 0),
    watchlistCount: Number(payload.classSummary?.watchlistCount ?? 0),
    riskTopicCount: Number(payload.classSummary?.riskTopicCount ?? 0)
  },
  students: (payload.students || []).map((row: any) => ({
    id: Number(row.id),
    firstName: row.firstName ?? row.first_name,
    lastName: row.lastName ?? row.last_name,
    rollNumber: row.rollNumber ?? row.roll_number,
    totalAssessments: Number(row.totalAssessments ?? row.total_assessments ?? 0),
    overallPercentage: Number(row.overallPercentage ?? row.overall_percentage ?? 0),
    attendancePercentage: Number(row.attendancePercentage ?? row.attendance_percentage ?? 0),
    status: row.status || 'stable',
    reasons: Array.isArray(row.reasons) ? row.reasons : []
  })),
  topics: (payload.topics || []).map((row: any) => ({
    id: Number(row.id),
    topicName: row.topicName ?? row.topic_name,
    averagePercentage: Number(row.averagePercentage ?? row.average_percentage ?? 0),
    samples: Number(row.samples ?? 0),
    isRisk: Boolean(row.isRisk)
  })),
  guidance: payload.guidance || {
    lowPerformanceRule: '',
    highPerformanceRule: '',
    topicUnderstandingRule: '',
    classUnderstandingRule: ''
  }
});

type InterventionSignals = ReturnType<typeof normalizeInterventionSignals>;
type InterventionStudent = InterventionSignals['students'][number];
type InterventionTopic = InterventionSignals['topics'][number];

const Analytics: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [analytics, setAnalytics] = useState<(
    ClassAnalytics & {
      monthlyTrend?: Array<{ month: string; average_percentage: number }>;
      testPerformance?: Array<{
        id: number;
        title: string;
        status: string;
        testType: string;
        totalQuestions: number;
        totalSubmissions: number;
        gradedSubmissions: number;
        averagePercentage: number;
        minPercentage: number;
        maxPercentage: number;
        startTime?: string | null;
        endTime?: string | null;
      }>;
      testStats?: {
        totalTests: number;
        scheduledTests: number;
        activeTests: number;
        completedTests: number;
        studentsWithResults: number;
        gradedSubmissions: number;
      };
    }
  ) | null>(null);
  const [signals, setSignals] = useState<InterventionSignals | null>(null);
  const [lowThreshold, setLowThreshold] = useState(50);
  const [highThreshold, setHighThreshold] = useState(80);
  const [topicThreshold, setTopicThreshold] = useState(60);
  const [classThreshold, setClassThreshold] = useState(65);
  const [attendanceThreshold, setAttendanceThreshold] = useState(75);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchAnalytics();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass) {
      fetchInterventionSignals();
    }
  }, [selectedClass, lowThreshold, highThreshold, topicThreshold, classThreshold, attendanceThreshold]);

  const fetchClasses = async () => {
    try {
      const response = await classAPI.getAll();
      setClasses(response.data.classes);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getClassAnalytics(parseInt(selectedClass));
      setAnalytics(normalizeAnalytics(response.data));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterventionSignals = async () => {
    try {
      const response = await analyticsAPI.getClassInterventionSignals(parseInt(selectedClass), {
        lowThreshold,
        highThreshold,
        topicThreshold,
        classThreshold,
        attendanceThreshold
      });
      setSignals(normalizeInterventionSignals(response.data));
    } catch (error) {
      console.error('Error fetching intervention signals:', error);
      setSignals(null);
    }
  };

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const classAverageValue = signals
    ? Math.round(signals.classSummary.classAverage)
    : Math.round(analytics?.attendanceStats?.attendancePercentage || 0);
  const supportCountValue = signals
    ? signals.classSummary.criticalCount + signals.classSummary.watchlistCount
    : analytics?.weakStudents?.length || 0;
  const revisionTopicCountValue = signals
    ? signals.classSummary.riskTopicCount
    : 0;

  const insightCards = analytics
    ? [
        {
          title: 'Class Average',
          value: `${classAverageValue}%`,
          hint: signals?.classSummary.classNeedsIntervention
            ? 'Class understanding needs revision.'
            : 'Class understanding is within range.',
          tone: signals?.classSummary.classNeedsIntervention ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'
        },
        {
          title: 'Students Need Support',
          value: `${supportCountValue}`,
          hint: supportCountValue > 0 ? 'Low accuracy students are highlighted below.' : 'No urgent performance risks.',
          tone: supportCountValue > 0 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
        },
        {
          title: 'Topics To Revise',
          value: `${revisionTopicCountValue}`,
          hint: revisionTopicCountValue > 0 ? 'These topics need another teaching pass.' : 'Topic understanding is healthy.',
          tone: revisionTopicCountValue > 0 ? 'text-indigo-700 bg-indigo-50' : 'text-emerald-700 bg-emerald-50'
        }
      ]
    : [];

  const criticalStudents = signals?.students.filter((student: InterventionStudent) => student.status === 'critical') ?? [];
  const watchlistStudents = signals?.students.filter((student: InterventionStudent) => student.status === 'watchlist') ?? [];
  const revisionTopics = signals?.topics.filter((topic: InterventionTopic) => topic.isRisk) ?? [];

  const trendData = (analytics?.monthlyTrend || [])
    .slice()
    .reverse()
    .map((item) => ({
      month: item.month ? new Date(item.month).toLocaleString('default', { month: 'short' }) : 'N/A',
      average: Number(item.average_percentage) || 0
    }));

  return (
    <Layout>
      <div>
        <PageHeader
          title="Analytics & Insights"
          description="Track performance trends and identify students who need attention early"
        />

        <div className="card mb-6 p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Select Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-base w-full md:w-1/2"
          >
            <option value="">Choose a class</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} - Grade {cls.grade} {cls.section}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <LoadingState message="Loading analytics..." />
        )}

        {analytics && !loading && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-teal-50 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Early Intervention Automation</h3>
              <p className="mt-1 text-sm text-slate-600">
                Set thresholds for low/high performance and topic understanding. The system flags students and topics early so teachers can intervene on time.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  Low performance %
                  <input type="range" min={35} max={70} value={lowThreshold} onChange={(e) => setLowThreshold(Number(e.target.value))} className="mt-2 w-full" />
                  <div className="mt-1 font-semibold text-slate-900">{lowThreshold}%</div>
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  High performance %
                  <input type="range" min={60} max={95} value={highThreshold} onChange={(e) => setHighThreshold(Number(e.target.value))} className="mt-2 w-full" />
                  <div className="mt-1 font-semibold text-slate-900">{highThreshold}%</div>
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  Topic understanding %
                  <input type="range" min={40} max={85} value={topicThreshold} onChange={(e) => setTopicThreshold(Number(e.target.value))} className="mt-2 w-full" />
                  <div className="mt-1 font-semibold text-slate-900">{topicThreshold}%</div>
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  Class understanding %
                  <input type="range" min={45} max={85} value={classThreshold} onChange={(e) => setClassThreshold(Number(e.target.value))} className="mt-2 w-full" />
                  <div className="mt-1 font-semibold text-slate-900">{classThreshold}%</div>
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  Attendance alert %
                  <input type="range" min={50} max={95} value={attendanceThreshold} onChange={(e) => setAttendanceThreshold(Number(e.target.value))} className="mt-2 w-full" />
                  <div className="mt-1 font-semibold text-slate-900">{attendanceThreshold}%</div>
                </label>
              </div>

              {signals && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">How the thresholds work</p>
                  <ul className="mt-2 space-y-1.5">
                    <li>Below {signals.thresholds.lowThreshold}% means the student needs immediate support.</li>
                    <li>Between {signals.thresholds.lowThreshold}% and {signals.thresholds.highThreshold}% is watchlist territory.</li>
                    <li>At or above {signals.thresholds.highThreshold}% is considered stable performance.</li>
                    <li>Below {signals.thresholds.topicThreshold}% on a topic means the class may need topic revision.</li>
                    <li>Below {signals.thresholds.classThreshold}% class average means the teacher should re-teach or slow down.</li>
                    <li>Below {signals.thresholds.attendanceThreshold}% attendance triggers an early alert.</li>
                  </ul>
                </div>
              )}

              {signals && (
                <>
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Class average</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{Math.round(signals.classSummary.classAverage)}%</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-rose-700">Critical</p>
                      <p className="mt-1 text-2xl font-bold text-rose-800">{signals.classSummary.criticalCount}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-amber-700">Watchlist</p>
                      <p className="mt-1 text-2xl font-bold text-amber-800">{signals.classSummary.watchlistCount}</p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-indigo-700">Risk topics</p>
                      <p className="mt-1 text-2xl font-bold text-indigo-800">{signals.classSummary.riskTopicCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-rose-900">Students to focus on first</h4>
                          <p className="text-xs text-rose-700">These students need immediate teacher attention based on their score and attendance.</p>
                        </div>
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          {criticalStudents.length} critical
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(criticalStudents.length > 0 ? criticalStudents : watchlistStudents).map((student: {
                          id: number;
                          firstName: string;
                          lastName: string;
                          rollNumber: string;
                          overallPercentage: number;
                          attendancePercentage: number;
                          status: string;
                          reasons?: string[];
                        }) => (
                          <div key={student.id} className="rounded-lg border border-rose-100 bg-white px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {student.firstName} {student.lastName} ({student.rollNumber})
                                </p>
                                <p className="text-xs text-slate-500">
                                  Overall {Math.round(student.overallPercentage)}% • Attendance {Math.round(student.attendancePercentage)}%
                                </p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.status === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                {student.status}
                              </span>
                            </div>
                            {student.reasons && student.reasons.length > 0 && (
                              <p className="mt-2 text-xs text-slate-600">{student.reasons.join(' • ')}</p>
                            )}
                          </div>
                        ))}
                        {(criticalStudents.length === 0 && watchlistStudents.length === 0) && (
                          <p className="text-sm text-slate-500">No support students were flagged for the current thresholds.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-indigo-900">Revision topics</h4>
                          <p className="text-xs text-indigo-700">These topics are below the understanding threshold and should be revisited.</p>
                        </div>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                          {revisionTopics.length} need revision
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(revisionTopics.length > 0 ? revisionTopics : signals.topics).map((topic: {
                          id: number;
                          topicName: string;
                          averagePercentage: number;
                          samples: number;
                          isRisk: boolean;
                        }) => (
                          <div key={topic.id} className="rounded-lg border border-indigo-100 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{topic.topicName}</p>
                                <p className="text-xs text-slate-500">{topic.samples} assessments sampled</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${topic.isRisk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {Math.round(topic.averagePercentage)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900">Flagged students</h4>
                      <div className="mt-3 space-y-2">
                        {signals.students.map((student: {
                          id: number;
                          firstName: string;
                          lastName: string;
                          rollNumber: string;
                          overallPercentage: number;
                          attendancePercentage: number;
                          status: string;
                          reasons?: string[];
                        }) => (
                          <div key={student.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{student.firstName} {student.lastName} ({student.rollNumber})</p>
                              <p className="text-xs text-slate-500">Overall {Math.round(student.overallPercentage)}% • Attendance {Math.round(student.attendancePercentage)}%</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.status === 'critical' ? 'bg-rose-100 text-rose-700' : student.status === 'watchlist' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {student.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900">Topic understanding</h4>
                      <div className="mt-3 space-y-2">
                        {signals.topics.map((topic: {
                          id: number;
                          topicName: string;
                          averagePercentage: number;
                          isRisk: boolean;
                        }) => (
                          <div key={topic.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{topic.topicName}</p>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${topic.isRisk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {Math.round(topic.averagePercentage)}%
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className={`mt-4 rounded-lg p-3 text-sm ${signals.classSummary.classNeedsIntervention ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        {signals.classSummary.classNeedsIntervention
                          ? 'Class-level alert: topic understanding is below threshold. Focused revision is recommended.'
                          : 'Class-level status: understanding is within healthy threshold.'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="card p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Test Results Overview</h3>
                  <p className="text-sm text-slate-600">Summary of test submissions and average scores for the selected class.</p>
                </div>
                <div className="text-sm text-slate-500">Connected to test submissions and test analytics data</div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total tests</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{analytics.testStats?.totalTests ?? 0}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-700">Scheduled</p>
                  <p className="mt-1 text-2xl font-bold text-blue-800">{analytics.testStats?.scheduledTests ?? 0}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Active</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-800">{analytics.testStats?.activeTests ?? 0}</p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-700">Completed</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-800">{analytics.testStats?.completedTests ?? 0}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Students with results</p>
                  <p className="mt-1 text-2xl font-bold text-amber-800">{analytics.testStats?.studentsWithResults ?? 0}</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-teal-700">Graded submissions</p>
                  <p className="mt-1 text-2xl font-bold text-teal-800">{analytics.testStats?.gradedSubmissions ?? 0}</p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Test</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Submissions</th>
                        <th className="px-4 py-3 text-left font-medium">Graded</th>
                        <th className="px-4 py-3 text-left font-medium">Average</th>
                        <th className="px-4 py-3 text-left font-medium">Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(analytics.testPerformance || []).length > 0 ? (
                        analytics.testPerformance!.map((test) => (
                          <tr key={test.id}>
                            <td className="px-4 py-3 font-medium text-slate-900">{test.title}</td>
                            <td className="px-4 py-3 capitalize text-slate-600">{test.status}</td>
                            <td className="px-4 py-3 text-slate-700">{test.totalSubmissions}</td>
                            <td className="px-4 py-3 text-slate-700">{test.gradedSubmissions}</td>
                            <td className="px-4 py-3 text-slate-900">{Math.round(test.averagePercentage)}%</td>
                            <td className="px-4 py-3 text-slate-600">{Math.round(test.minPercentage)}% - {Math.round(test.maxPercentage)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={6}>
                            No test submissions are available for this class yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="card p-6">
                <h3 className="mb-2 text-sm font-medium text-slate-600">
                  Total Students
                </h3>
                <p className="text-3xl font-bold text-slate-900">
                  {analytics.attendanceStats?.totalStudents || 0}
                </p>
              </div>

              <div className="card p-6">
                <h3 className="mb-2 text-sm font-medium text-slate-600">
                  Attendance Rate
                </h3>
                <p className="text-3xl font-bold text-green-600">
                  {Math.round((analytics.attendanceStats?.attendancePercentage || 0))}%
                </p>
              </div>

              <div className="card p-6">
                <h3 className="mb-2 text-sm font-medium text-slate-600">
                  Total Assessments
                </h3>
                <p className="text-3xl font-bold text-slate-900">
                  {analytics.attendanceStats?.totalAttendanceRecords || 0}
                </p>
              </div>
            </div>

            {insightCards.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {insightCards.map((card) => (
                  <div key={card.title} className={`rounded-2xl p-4 ${card.tone}`}>
                    <p className="text-xs uppercase tracking-wide">{card.title}</p>
                    <p className="mt-1 text-2xl font-bold">{card.value}</p>
                    <p className="mt-1 text-sm opacity-90">{card.hint}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Performance Trend (Last 6 Months)</h3>
              {trendData.length === 0 ? (
                <p className="text-sm text-slate-500">No monthly trend data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Subject-wise Performance
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.subjectWisePerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="subjectName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averagePercentage" fill="#0ea5e9" name="Average %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Grade Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.gradeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ grade, count }) => `${grade}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.gradeDistribution.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Top Performers
                </h3>
                <div className="space-y-3">
                  {analytics.topPerformers.slice(0, 5).map((student, index) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-sm text-gray-600">Roll: {student.rollNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {Math.round(student.averagePercentage)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Students Needing Attention
                </h3>
                <div className="space-y-3">
                  {analytics.weakStudents.slice(0, 5).map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-sm text-gray-600">Roll: {student.rollNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">
                          {Math.round(student.averagePercentage)}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {analytics.weakStudents.length === 0 && (
                    <p className="text-center text-gray-500 py-4">
                      All students performing well!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedClass && !loading && (
          <EmptyState title="Select a class to view analytics" />
        )}
      </div>
    </Layout>
  );
};

export default Analytics;
