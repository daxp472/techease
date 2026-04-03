import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { attendanceAPI, classAPI } from '../services/api';
import { Attendance as AttendanceType, Class } from '../types';
import { CheckCircle, XCircle } from 'lucide-react';

const Attendance: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchClassStudents();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    try {
      const response = await classAPI.getAll();
      setClasses(response.data.classes);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchClassStudents = async () => {
    try {
      setLoading(true);
      const studentsRes = await classAPI.getStudents(parseInt(selectedClass));
      const attendanceRes = await attendanceAPI.getByClass({
        classId: selectedClass,
        date: selectedDate
      });

      setStudents(studentsRes.data.students);

      const attendanceMap: { [key: number]: string } = {};
      attendanceRes.data.attendance.forEach((att: AttendanceType) => {
        attendanceMap[att.studentId] = att.status;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching class students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId: number, status: string) => {
    setAttendance({ ...attendance, [studentId]: status });
  };

  const handleSubmit = async () => {
    if (!selectedClass) {
      alert('Please select a class');
      return;
    }

    try {
      const attendanceRecords = students.map(student => ({
        studentId: student.id,
        classId: parseInt(selectedClass),
        subjectId: 1,
        date: selectedDate,
        status: attendance[student.id] || 'absent',
        remarks: null
      }));

      await attendanceAPI.markBulk({ attendanceRecords });
      alert('Attendance marked successfully!');
    } catch (error) {
      alert('Error marking attendance');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Attendance Management</h1>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Choose a class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - Grade {cls.grade} {cls.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {selectedClass && !loading && students.length > 0 && (
            <>
              <div className="mb-4 flex space-x-4">
                <button
                  onClick={() => {
                    const newAttendance: { [key: number]: string } = {};
                    students.forEach(student => {
                      newAttendance[student.id] = 'present';
                    });
                    setAttendance(newAttendance);
                  }}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle size={18} className="mr-2" />
                  Mark All Present
                </button>
                <button
                  onClick={() => {
                    const newAttendance: { [key: number]: string } = {};
                    students.forEach(student => {
                      newAttendance[student.id] = 'absent';
                    });
                    setAttendance(newAttendance);
                  }}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <XCircle size={18} className="mr-2" />
                  Mark All Absent
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Roll No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.rollNumber || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {['present', 'absent', 'late'].map((status) => (
                              <button
                                key={status}
                                onClick={() => handleAttendanceChange(student.id, status)}
                                className={`px-4 py-2 rounded-md text-sm font-medium ${
                                  attendance[student.id] === status
                                    ? getStatusColor(status)
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleSubmit}
                  className="w-full md:w-auto px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
                >
                  Save Attendance
                </button>
              </div>
            </>
          )}

          {selectedClass && !loading && students.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              No students found in this class
            </div>
          )}

          {!selectedClass && (
            <div className="text-center py-8 text-gray-600">
              Please select a class to mark attendance
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Attendance;
