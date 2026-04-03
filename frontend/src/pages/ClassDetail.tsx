import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { classAPI } from '../services/api';
import { Class, Student } from '../types';

const ClassDetail: React.FC = () => {
  const { id } = useParams();
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [classRes, studentsRes] = await Promise.all([
          classAPI.getById(Number(id)),
          classAPI.getStudents(Number(id))
        ]);

        setClassData(classRes.data.class);
        setStudents(studentsRes.data.students || []);
      } catch {
        setClassData(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [id]);

  if (loading) {
    return <Layout><LoadingState message="Loading class details..." /></Layout>;
  }

  if (!classData) {
    return <Layout><EmptyState title="Class not found" description="The selected class could not be loaded." /></Layout>;
  }

  return (
    <Layout>
      <div>
        <PageHeader
          title={classData.name}
          description={`Grade ${classData.grade} ${classData.section} • ${classData.academicYear}`}
          actions={<Link to="/classes" className="btn-secondary">Back to Classes</Link>}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Class Info</h3>
            <div className="space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Room:</span> {classData.roomNumber || '-'}</p>
              <p><span className="font-semibold">Teacher:</span> {(classData as any).teacherFirstName || '-'} {(classData as any).teacherLastName || ''}</p>
              <p><span className="font-semibold">Students:</span> {(classData as any).studentCount || students.length}</p>
            </div>
          </div>

          <div className="card p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Students</h3>
            {students.length > 0 ? (
              <div className="space-y-2">
                {students.map((student) => (
                  <Link key={student.id} to={`/students/${student.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                    <div>
                      <p className="font-medium text-slate-900">{student.firstName} {student.lastName}</p>
                      <p className="text-sm text-slate-500">Roll {student.rollNumber || '-'}</p>
                    </div>
                    <span className="text-sm text-slate-500">View profile</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No students enrolled" description="Enroll students to show them here." />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ClassDetail;
