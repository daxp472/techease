import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { attendanceAPI, classAPI } from '../services/api';
import { Attendance as AttendanceType, Class } from '../types';
import { CheckCircle, XCircle, Clock3, Download, FileDown, Save } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import { useToast } from '../components/ui/ToastContext';
import { exportToCSV, exportTableAsPrintPDF } from '../utils/export';
import AttendanceReviewModal from '../components/ui/AttendanceReviewModal';

const Attendance: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{ [key: number]: string }>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isAttendanceLocked, setIsAttendanceLocked] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const { showToast } = useToast();

  const todayDate = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === todayDate;
  const getSelectedDateLabel = () => new Date(selectedDate).toLocaleDateString();

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
      setClasses(response.data.classes || []);
    } catch (error) {
      showToast('Error fetching classes', 'error');
    }
  };

  const fetchClassStudents = async () => {
    try {
      setLoading(true);
      setIsAttendanceLocked(false);
      setShowReview(false);

      const studentsRes = await classAPI.getStudents(parseInt(selectedClass));
      const attendanceRes = await attendanceAPI.getByClass({
        classId: selectedClass,
        date: selectedDate
      });

      const studentsList = studentsRes.data.students || [];
      setStudents(studentsList);

      const attendanceMap: { [key: number]: string } = {};
      const attendanceList = attendanceRes.data.attendance || [];
      
      attendanceList.forEach((att: AttendanceType) => {
        attendanceMap[att.studentId] = att.status;
      });
      
      setAttendance(attendanceMap);
      
      const lockRes = await attendanceAPI.getLockStatus({
        classId: selectedClass,
        date: selectedDate
      });
      setIsAttendanceLocked(Boolean(lockRes.data?.locked));
    } catch (error) {
      console.error('Error fetching class attendance:', error);
      showToast('Unable to load class attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId: number, status: string) => {
    if (isAttendanceLocked) {
      showToast('Attendance is locked for this class/date. Cannot make changes.', 'error');
      return;
    }
    setAttendance({ ...attendance, [studentId]: status });
  };

  const handleSubmitForReview = () => {
    if (!selectedClass) {
      showToast('Please select a class', 'error');
      return;
    }

    // Check if all students have been marked
    const allMarked = students.every((s: any) => attendance[s.id]);
    if (!allMarked) {
      showToast('Please mark attendance for all students before submitting', 'error');
      return;
    }

    setShowReview(true);
  };

  const handleConfirmSubmit = async () => {
    setSaving(true);
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
      await attendanceAPI.lock({ classId: parseInt(selectedClass), date: selectedDate });
      showToast('Attendance submitted and locked successfully', 'success');
      setShowReview(false);
      setIsAttendanceLocked(true);
      
      // Refresh to confirm locked state
      setTimeout(() => {
        fetchClassStudents();
      }, 500);
    } catch (error) {
      console.error('Error submitting attendance:', error);
      showToast('Error submitting attendance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyBulkStatus = (status: string) => {
    if (isAttendanceLocked) {
      showToast('Attendance is locked for this class/date. Cannot make changes.', 'error');
      return;
    }

    const newAttendance: { [key: number]: string } = {};
    students.forEach((student) => {
      newAttendance[student.id] = status;
    });
    setAttendance(newAttendance);
    showToast(`Set all students to ${status}`, 'info');
  };

  const filteredStudents = useMemo(
    () => students.filter((student) => `${student.firstName} ${student.lastName} ${student.rollNumber || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())),
    [students, search]
  );

  const attendanceSummary = useMemo(() => {
    const statuses = Object.values(attendance);
    return {
      present: statuses.filter((status) => status === 'present').length,
      absent: statuses.filter((status) => status === 'absent').length,
      late: statuses.filter((status) => status === 'late').length,
      total: students.length
    };
  }, [attendance, students.length]);

  const handleCSVExport = () => {
    exportToCSV(
      `attendance-${selectedDate}`,
      ['Roll No', 'Student Name', 'Status', 'Date'],
      filteredStudents.map((student) => [
        student.rollNumber || '-',
        `${student.firstName || ''} ${student.lastName || ''}`.trim() || '-',
        attendance[student.id] || 'absent',
        selectedDate || '-'
      ])
    );
    showToast('Attendance exported as CSV', 'success');
  };

  const handlePDFExport = () => {
    if (!tableRef.current) {
      return;
    }
    exportTableAsPrintPDF('TeachEase - Attendance', tableRef.current.outerHTML);
    showToast('Print dialog opened for PDF export', 'info');
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
        <PageHeader
          title="Attendance Management"
          description="Mark quickly, review instantly, and export in one click"
          actions={
            selectedClass ? (
              <>
                <button type="button" className="btn-secondary" onClick={handleCSVExport}>
                  <Download size={16} className="mr-2" />
                  Export CSV
                </button>
                <button type="button" className="btn-secondary" onClick={handlePDFExport}>
                  <FileDown size={16} className="mr-2" />
                  Export PDF
                </button>
              </>
            ) : null
          }
        />

        <div className="card mb-6 p-6">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Select Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input-base"
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
              <label className="mb-2 block text-sm font-medium text-slate-700">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-base"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Search Student</label>
              <SearchInput value={search} onChange={setSearch} placeholder="Filter by name or roll" />
            </div>
          </div>

          {selectedClass && !isToday && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Attendance is read-only for this date. Only today\'s attendance can be edited.
            </div>
          )}

          {/* Attendance Locked Alert */}
          {selectedClass && isAttendanceLocked && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
              <div className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5">✓</div>
              <p className="text-sm text-emerald-800">
                Attendance for {getSelectedDateLabel()} has been submitted and locked. No further changes are allowed.
              </p>
            </div>
          )}

          {selectedClass && (
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Present</p>
                <p className="text-2xl font-bold text-emerald-800">{attendanceSummary.present}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-700">Absent</p>
                <p className="text-2xl font-bold text-rose-800">{attendanceSummary.absent}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-700">Late</p>
                <p className="text-2xl font-bold text-amber-800">{attendanceSummary.late}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-800">{attendanceSummary.total}</p>
              </div>
            </div>
          )}

          {selectedClass && !loading && students.length > 0 && isToday && !isAttendanceLocked && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => applyBulkStatus('present')}
                  disabled={isAttendanceLocked}
                  className="btn-secondary border-emerald-200 text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} className="mr-2" />
                  Mark All Present
                </button>
                <button
                  onClick={() => applyBulkStatus('absent')}
                  disabled={isAttendanceLocked}
                  className="btn-secondary border-rose-200 text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={18} className="mr-2" />
                  Mark All Absent
                </button>
                <button
                  onClick={() => applyBulkStatus('late')}
                  disabled={isAttendanceLocked}
                  className="btn-secondary border-amber-200 text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock3 size={18} className="mr-2" />
                  Mark All Late
                </button>
              </div>

              <div className="overflow-x-auto">
                <table ref={tableRef} className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        Roll No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                          {student.rollNumber || '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex space-x-2">
                            {['present', 'absent', 'late'].map((status) => (
                              <button
                                key={status}
                                onClick={() => handleAttendanceChange(student.id, status)}
                                disabled={isAttendanceLocked}
                                className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                                  attendance[student.id] === status
                                    ? getStatusColor(status)
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  onClick={handleSubmitForReview}
                  disabled={saving}
                  className="btn-primary w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} className="mr-2" />
                  {saving ? 'Submitting...' : 'Submit Attendance for Review'}
                </button>
              </div>
            </>
          )}

          {selectedClass && (!isToday || isAttendanceLocked) && (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {(['present', 'absent', 'late'] as const).map((status) => {
                const items = filteredStudents.filter((student) => (attendance[student.id] || 'absent') === status);
                return (
                  <div key={status} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{status}</h4>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {items.map((student) => (
                        <div key={student.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                          {student.firstName} {student.lastName} {student.rollNumber ? `• ${student.rollNumber}` : ''}
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-sm text-slate-500">No students marked {status}.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedClass && loading && <LoadingState compact message="Loading class roster..." />}

          {selectedClass && !loading && students.length > 0 && filteredStudents.length === 0 && (
            <EmptyState title="No students match this search" description="Try a different name or roll number." />
          )}

          {selectedClass && !loading && students.length === 0 && (
            <EmptyState title="No students found in this class" />
          )}

          {!selectedClass && (
            <EmptyState title="Please select a class" description="Attendance tools will appear once a class is selected." />
          )}
        </div>

        {/* Attendance Review Modal */}
        {selectedClass && students.length > 0 && (
          <AttendanceReviewModal
            isOpen={showReview}
            attendanceData={students.map((s) => ({
              id: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              rollNumber: s.rollNumber,
              status: attendance[s.id] || 'absent'
            }))}
            date={selectedDate}
            onSubmit={handleConfirmSubmit}
            onCancel={() => {
              setShowReview(false);
            }}
            isSubmitting={saving}
          />
        )}
      </div>
    </Layout>
  );
};

export default Attendance;
