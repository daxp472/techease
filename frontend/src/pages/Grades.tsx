import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { gradeAPI, classAPI, studentAPI } from '../services/api';
import { Grade, Class, ExamType } from '../types';
import { Plus, Pencil, Save, X, Download, FileDown } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import { useToast } from '../components/ui/ToastContext';
import { exportToCSV, exportTableAsPrintPDF } from '../utils/export';
import { useAuth } from '../context/AuthContext';

const Grades: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportData, setReportData] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [inlineForm, setInlineForm] = useState({ marksObtained: '', maxMarks: '', examDate: '' });
  const tableRef = useRef<HTMLTableElement>(null);
  const { showToast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    subjectId: '1',
    examTypeId: '',
    marksObtained: '',
    maxMarks: '',
    examDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchClasses();
    fetchExamTypes();
    if (user?.role === 'student') {
      void studentAPI.getById(user.id).then((response) => {
        const classId = response.data.student?.classId;
        if (classId) {
          setSelectedClass(String(classId));
          setFormData((current) => ({ ...current, classId: String(classId) }));
        }
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchGrades();
      fetchStudents();
    }
  }, [selectedClass]);

  const fetchClasses = async () => {
    try {
      const response = await classAPI.getAll();
      setClasses(response.data.classes);
    } catch (error) {
      showToast('Error fetching classes', 'error');
    }
  };

  const fetchExamTypes = async () => {
    try {
      const response = await gradeAPI.getExamTypes();
      setExamTypes(response.data.examTypes);
    } catch (error) {
      showToast('Error fetching exam types', 'error');
    }
  };

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const response = await gradeAPI.getByClass({ classId: selectedClass });
      setGrades(response.data.grades);
    } catch (error) {
      showToast('Error fetching grades', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await studentAPI.getAll({ classId: selectedClass });
      setStudents(response.data.students);
    } catch (error) {
      showToast('Error fetching students', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await gradeAPI.add({
        ...formData,
        studentId: parseInt(formData.studentId),
        classId: parseInt(formData.classId),
        subjectId: parseInt(formData.subjectId),
        examTypeId: parseInt(formData.examTypeId),
        marksObtained: parseFloat(formData.marksObtained),
        maxMarks: parseFloat(formData.maxMarks)
      });
      setShowModal(false);
      fetchGrades();
      resetForm();
      showToast('Grade added successfully', 'success');
    } catch (error) {
      showToast('Error adding grade', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startInlineEdit = (grade: Grade) => {
    setEditingRowId(grade.id);
    setInlineForm({
      marksObtained: String(grade.marksObtained),
      maxMarks: String(grade.maxMarks),
      examDate: grade.examDate ? grade.examDate.slice(0, 10) : new Date().toISOString().split('T')[0]
    });
  };

  const saveInlineEdit = async (gradeId: number) => {
    try {
      await gradeAPI.update(gradeId, {
        marksObtained: Number(inlineForm.marksObtained),
        maxMarks: Number(inlineForm.maxMarks),
        examDate: inlineForm.examDate,
        remarks: null
      });
      setEditingRowId(null);
      showToast('Grade updated', 'success');
      await fetchGrades();
    } catch (error) {
      showToast('Error updating grade', 'error');
    }
  };

  const generateReport = async () => {
    if (!selectedClass || !reportStudentId) {
      showToast('Select class and student to generate report', 'error');
      return;
    }

    try {
      const response = await gradeAPI.getReportCard({ studentId: Number(reportStudentId), classId: Number(selectedClass) });
      setReportData(response.data);
      showToast('Report generated', 'success');
    } catch (error) {
      setReportData(null);
      showToast('Unable to generate report', 'error');
    }
  };

  const filteredGrades = useMemo(
    () => grades.filter((grade) => `${grade.firstName} ${grade.lastName} ${grade.subjectName} ${grade.examTypeName}`
      .toLowerCase()
      .includes(search.toLowerCase())),
    [grades, search]
  );

  const averageScore = useMemo(() => {
    if (filteredGrades.length === 0) {
      return 0;
    }
    const total = filteredGrades.reduce((sum, item) => {
      const marks = Number(item.marksObtained) || 0;
      const max = Number(item.maxMarks) || 1;
      return sum + (max > 0 ? (marks / max) * 100 : 0);
    }, 0);
    return isNaN(total) ? 0 : total / filteredGrades.length;
  }, [filteredGrades]);

  const handleCSVExport = () => {
    exportToCSV(
      `grades-${new Date().toISOString().slice(0, 10)}`,
      ['Student', 'Subject', 'Exam Type', 'Marks', 'Grade', 'Percentage'],
      filteredGrades.map((grade) => [
        `${grade.firstName} ${grade.lastName}`,
        grade.subjectName,
        grade.examTypeName,
        `${grade.marksObtained}/${grade.maxMarks}`,
        grade.grade,
        `${((grade.marksObtained / grade.maxMarks) * 100).toFixed(2)}%`
      ])
    );
    showToast('Grades exported as CSV', 'success');
  };

  const handlePDFExport = () => {
    if (!tableRef.current) {
      return;
    }
    exportTableAsPrintPDF('TeachEase - Grades', tableRef.current.outerHTML);
    showToast('Print dialog opened for PDF export', 'info');
  };

  const draftPercentage =
    Number(formData.maxMarks) > 0
      ? ((Number(formData.marksObtained || 0) / Number(formData.maxMarks)) * 100).toFixed(2)
      : '0.00';

  const resetForm = () => {
    setFormData({
      studentId: '',
      classId: selectedClass,
      subjectId: '1',
      examTypeId: '',
      marksObtained: '',
      maxMarks: '',
      examDate: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <Layout>
      <div>
        <PageHeader
          title="Grades Management"
          description="Fast grade entry, inline updates, and one-click report generation"
          actions={user?.role === 'student' ? null : (
            <>
              <button type="button" className="btn-secondary" onClick={handleCSVExport} disabled={!selectedClass || filteredGrades.length === 0}>
                <Download size={16} className="mr-2" />
                Export CSV
              </button>
              <button type="button" className="btn-secondary" onClick={handlePDFExport} disabled={!selectedClass || filteredGrades.length === 0}>
                <FileDown size={16} className="mr-2" />
                Export PDF
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                disabled={!selectedClass}
                className="btn-primary"
              >
                <Plus size={18} className="mr-2" />
                Add Grade
              </button>
            </>
          )}
        />

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-4 lg:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setReportData(null);
              }}
              className="input-base md:w-1/2"
              disabled={user?.role === 'student'}
            >
              <option value="">Choose a class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} - Grade {cls.grade} {cls.section}
                </option>
              ))}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Entries</p>
                <p className="text-xl font-bold text-slate-900">{filteredGrades.length}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Average score</p>
                <p className="text-xl font-bold text-emerald-800">{averageScore.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {user?.role !== 'student' && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Report Generation</h3>
            <select
              value={reportStudentId}
              onChange={(e) => setReportStudentId(e.target.value)}
              className="input-base mt-3"
            >
              <option value="">Select Student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName} ({student.rollNumber || '-'})
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary mt-3 w-full" onClick={generateReport}>
              Generate Report
            </button>
          </div>
          )}
        </div>

        {selectedClass && (
          <div className="card">
            <div className="border-b border-slate-200 p-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Search by student, subject, or exam type" />
            </div>
            {loading ? (
              <LoadingState compact message="Loading grades..." />
            ) : filteredGrades.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No grades found" description="Add your first grade or adjust filters." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table ref={tableRef} className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Exam Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Marks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Percentage
                    </th>
                      {user?.role !== 'student' && (
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                      )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredGrades.map((grade) => {
                    const isEditing = editingRowId === grade.id;
                    const percentage = ((grade.marksObtained / grade.maxMarks) * 100).toFixed(2);
                    return (
                    <tr key={grade.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        {grade.firstName} {grade.lastName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {grade.subjectName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {grade.examTypeName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={inlineForm.marksObtained}
                              onChange={(e) => setInlineForm({ ...inlineForm, marksObtained: e.target.value })}
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                            />
                            <span>/</span>
                            <input
                              type="number"
                              value={inlineForm.maxMarks}
                              onChange={(e) => setInlineForm({ ...inlineForm, maxMarks: e.target.value })}
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                            />
                          </div>
                        ) : (
                          `${grade.marksObtained} / ${grade.maxMarks}`
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800">
                          {grade.grade}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                        {isEditing
                          ? `${((Number(inlineForm.marksObtained || 0) / Number(inlineForm.maxMarks || 1)) * 100).toFixed(2)}%`
                          : `${percentage}%`}
                      </td>
                      {user?.role !== 'student' && (
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => saveInlineEdit(grade.id)} className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50">
                              <Save size={15} />
                            </button>
                            <button onClick={() => setEditingRowId(null)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startInlineEdit(grade)} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100">
                            <Pencil size={15} />
                          </button>
                        )}
                      </td>
                      )}
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {reportData && (
          <div className="card mt-6 p-6">
            <h3 className="text-xl font-bold text-slate-900">Report Card Preview</h3>
            <p className="mt-1 text-sm text-slate-600">
              {reportData.student.first_name} {reportData.student.last_name} • Roll {reportData.student.roll_number}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-xs uppercase text-slate-500">Overall %</p>
                <p className="text-xl font-bold text-slate-900">{reportData.overallStats.overall_percentage || 0}%</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs uppercase text-emerald-700">Total Exams</p>
                <p className="text-xl font-bold text-emerald-900">{reportData.overallStats.total_exams || 0}</p>
              </div>
              <div className="rounded-xl bg-sky-50 p-3">
                <p className="text-xs uppercase text-sky-700">Total Marks</p>
                <p className="text-xl font-bold text-sky-900">
                  {reportData.overallStats.total_marks_obtained || 0}/{reportData.overallStats.total_max_marks || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">Add Grade</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Student</label>
                  <select
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="input-base"
                  >
                    <option value="">Select Student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} ({student.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Exam Type</label>
                  <select
                    required
                    value={formData.examTypeId}
                    onChange={(e) => setFormData({ ...formData, examTypeId: e.target.value })}
                    className="input-base"
                  >
                    <option value="">Select Exam Type</option>
                    {examTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Marks Obtained</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.marksObtained}
                      onChange={(e) =>
                        setFormData({ ...formData, marksObtained: e.target.value })
                      }
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Max Marks</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.maxMarks}
                      onChange={(e) => setFormData({ ...formData, maxMarks: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                  Auto calculation: <strong>{draftPercentage}%</strong>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Exam Date</label>
                  <input
                    type="date"
                    required
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1"
                  >
                    {saving ? 'Saving...' : 'Add Grade'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Grades;
