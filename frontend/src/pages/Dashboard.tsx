import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, timetableAPI } from '../services/api';
import { DashboardStats, Timetable } from '../types';
import { Users, BookOpen, Calendar, ClipboardCheck } from 'lucide-react';
import Layout from '../components/Layout';

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
      setStats(statsRes.data);

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
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600 mb-8">Here's what's happening today</p>

        {user?.role === 'teacher' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">My Classes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.totalClasses || 0}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.totalStudents || 0}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Classes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.todaysClasses || 0}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Attendance Today</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.attendanceMarkedToday || 0}
                  </p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <ClipboardCheck className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'teacher' && todaysTimetable.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Today's Schedule - {getDayName(new Date().getDay())}
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {todaysTimetable.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {item.subjectName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {item.className} - Grade {item.grade} {item.section}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {item.startTime} - {item.endTime}
                      </p>
                      {item.roomNumber && (
                        <p className="text-sm text-gray-600">Room {item.roomNumber}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {user?.role === 'student' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Enrolled Classes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.enrolledClasses || 0}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Attendance</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {Math.round(stats.attendancePercentage || 0)}%
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <ClipboardCheck className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Grade</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {Math.round(stats.averageGrade || 0)}%
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
