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

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [todaysTimetable, setTodaysTimetable] = useState<Timetable[]>([]);
  const [attentionStudents, setAttentionStudents] = useState<DashboardAttentionStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await analyticsAPI.getDashboardStats();
      setStats(normalizeDashboardStats(statsRes.data));

      if (user?.role === 'teacher') {
        const [timetableRes, classesRes] = await Promise.all([
          timetableAPI.getByTeacher(),
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

  return (
    <Layout>
      <div>
        <PageHeader
          title={`Welcome back, ${user?.firstName || 'Teacher'}`}
          description="Today’s overview and your next high-impact actions"
          actions={
            user?.role === 'teacher' ? (
              <>
                <Link to="/attendance" className="btn-secondary">Quick Attendance</Link>
                <Link to="/grades" className="btn-primary">Open Gradebook</Link>
              </>
            ) : null
          }
        />

        {user?.role === 'teacher' && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card p-6">
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

            <div className="card p-6">
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

            <div className="card p-6">
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

            <div className="card p-6">
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

        {user?.role === 'teacher' && (
          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card xl:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-xl font-semibold text-slate-900">
                  Today’s Overview • {getDayName(new Date().getDay())}
                </h2>
                <Link to="/timetable" className="text-sm font-semibold text-teal-700">View Week</Link>
              </div>
              <div className="p-6">
                {todaysTimetable.length > 0 ? (
                  <div className="space-y-3">
                    {todaysTimetable.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center"
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

            <div className="card p-6">
              <div className="mb-4 flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-teal-700" />
                <h2 className="text-lg font-semibold text-slate-900">Pending Tasks</h2>
              </div>
              <div className="space-y-3">
                {teacherTasks.map((task) => (
                  <Link
                    key={task.label}
                    to={task.href}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm text-slate-600">{task.label}</p>
                      <p className="text-xl font-bold text-slate-900">{task.value}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  </Link>
                ))}
                <div className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
                  Tip: mark attendance right after each session to keep analytics accurate.
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'teacher' && (
          <div className="mb-8 card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-700" />
                <h2 className="text-lg font-semibold text-slate-900">Students Needing Attention</h2>
              </div>
              <Link to="/analytics" className="text-sm font-semibold text-teal-700">Open Full Analytics</Link>
            </div>

            {attentionStudents.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                Great work. No critical or watchlist students detected with the current thresholds.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {attentionStudents.map((student) => (
                  <div key={`${student.classId}-${student.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.status === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card p-6">
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

            <div className="card p-6">
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

            <div className="card p-6">
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
        )}

        {user?.role === 'admin' && (
          <EmptyState
            title="Admin analytics coming next"
            description="You can still use classes, students, and analytics sections for daily operations."
          />
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
