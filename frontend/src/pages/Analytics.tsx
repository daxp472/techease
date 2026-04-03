import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { analyticsAPI, classAPI } from '../services/api';
import { ClassAnalytics, Class } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const Analytics: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [analytics, setAnalytics] = useState<(ClassAnalytics & { monthlyTrend?: Array<{ month: string; average_percentage: number }> }) | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchAnalytics();
    }
  }, [selectedClass]);

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
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const insightCards = analytics
    ? [
        {
          title: 'Attendance Alert',
          value: `${Math.round(analytics.attendanceStats?.attendancePercentage || 0)}%`,
          hint: (analytics.attendanceStats?.attendancePercentage || 0) < 80 ? 'Attendance dropped this week.' : 'Attendance holding steady.',
          tone: (analytics.attendanceStats?.attendancePercentage || 0) < 80 ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'
        },
        {
          title: 'Students Need Support',
          value: `${(analytics.weakStudents?.length || 0)}`,
          hint: (analytics.weakStudents?.length || 0) > 0 ? 'Target coaching recommended.' : 'No urgent performance risks.',
          tone: (analytics.weakStudents?.length || 0) > 0 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
        }
      ]
    : [];

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
