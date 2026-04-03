import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { studentAPI, gradeAPI, attendanceAPI, analyticsAPI } from '../services/api';
import { Student, Grade } from '../types';

const StudentDetail: React.FC = () => {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
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
      </div>
    </Layout>
  );
};

export default StudentDetail;
