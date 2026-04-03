import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { timetableAPI, studentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Timetable as TimetableType } from '../types';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const Timetable: React.FC = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<TimetableType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    try {
      if (user?.role === 'teacher') {
        const response = await timetableAPI.getByTeacher();
        setTimetable(response.data.timetable);
      } else if (user?.role === 'student') {
        const studentRes = await studentAPI.getById(user.id);
        const classId = studentRes.data.student?.classId;
        if (classId) {
          const response = await timetableAPI.getByClass(classId);
          setTimetable(response.data.timetable);
        }
      }
    } catch (error) {
      console.error('Error fetching timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  const groupByDay = () => {
    const grouped: { [key: number]: TimetableType[] } = {};
    timetable.forEach((item) => {
      if (!grouped[item.dayOfWeek]) {
        grouped[item.dayOfWeek] = [];
      }
      grouped[item.dayOfWeek].push(item);
    });
    return grouped;
  };

  const groupedTimetable = groupByDay();

  if (loading) {
    return (
      <Layout>
        <LoadingState message="Loading timetable..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <PageHeader title="My Timetable" description="Weekly teaching schedule at a glance" />

        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((day) => (
            <div key={day} className="card">
              <div className="px-6 py-4 bg-primary-50 border-b border-primary-100">
                <h2 className="text-xl font-semibold text-primary-900">
                  {getDayName(day)}
                </h2>
              </div>
              <div className="p-6">
                {groupedTimetable[day] && groupedTimetable[day].length > 0 ? (
                  <div className="space-y-3">
                    {groupedTimetable[day]
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((item) => (
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
                ) : (
                  <EmptyState title="No classes scheduled" description="Enjoy the free slot or update your timetable." />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Timetable;
