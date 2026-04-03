import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, timetableAPI } from '../services/api';
import { DashboardStats, Timetable } from '../types';
import { Users, BookOpen, Calendar, ClipboardCheck, ListTodo, ArrowUpRight } from 'lucide-react';
import Layout from '../components/Layout';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [todaysTimetable, setTodaysTimetable] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await analyticsAPI.getDashboardStats();
      const stats = statsRes.data.stats || {
        totalClasses: 0,
        totalStudents: 0,
        todaysClasses: 0,
        attendanceMarkedToday: 0
      };
      setStats(stats);

      if (user?.role === 'teacher') {
        const timetableRes = await timetableAPI.getByTeacher();
        const today = new Date().getDay();
        const todaysSchedule = timetableRes.data.timetable.filter(
          (item: Timetable) => item.dayOfWeek === today
        );
        setTodaysTimetable(todaysSchedule);
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
