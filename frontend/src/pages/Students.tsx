import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { studentAPI, classAPI } from '../services/api';
import { Student, Class } from '../types';
import { Plus, CreditCard as Edit, Trash2, Download, FileDown, ArrowUpDown, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ConfirmModal from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/ToastContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { exportToCSV, exportTableAsPrintPDF } from '../utils/export';

const Students: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'rollNumber'>('rollNumber');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const { showToast } = useToast();
  const debouncedSearch = useDebouncedValue(search, 300);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    classId: '',
    rollNumber: ''
  });

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedClass) params.classId = selectedClass;
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await studentAPI.getAll(params);

      const sortedStudents = [...response.data.students].sort((a, b) => {
        if (sortBy === 'rollNumber') {
          return (a.rollNumber || '').localeCompare(b.rollNumber || '');
        }
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });

      setStudents(sortedStudents);
    } catch (error) {
      showToast('Unable to fetch students right now', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await classAPI.getAll();
      setClasses(response.data.classes);
    } catch (error) {
      showToast('Unable to load class filters', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingStudent) {
        await studentAPI.update(editingStudent.id, formData);
        showToast('Student updated successfully', 'success');
      } else {
        await studentAPI.create(formData);
        showToast('Student added successfully', 'success');
      }
      setShowModal(false);
      resetForm();
      fetchStudents();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Error saving student', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) {
      return;
    }

    setDeletingId(confirmDeleteId);
    try {
      await studentAPI.delete(confirmDeleteId);
      showToast('Student deleted', 'success');
      await fetchStudents();
    } catch (error) {
      showToast('Error deleting student', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      email: student.email,
      password: '',
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || '',
      classId: student.classId?.toString() || '',
      rollNumber: student.rollNumber || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      classId: '',
      rollNumber: ''
    });
    setEditingStudent(null);
  };

  const filteredSummary = useMemo(
    () => `${students.length} student${students.length === 1 ? '' : 's'} found`,
    [students.length]
  );

  const handleCSVExport = () => {
    exportToCSV(
      `students-${new Date().toISOString().slice(0, 10)}`,
      ['Roll No', 'Name', 'Email', 'Class', 'Phone'],
      students.map((student) => [
        student.rollNumber || '-',
        `${student.firstName} ${student.lastName}`,
        student.email,
        student.className ? `${student.className} - ${student.grade} ${student.section}` : '-',
        student.phone || '-'
      ])
    );
    showToast('Students exported as CSV', 'success');
  };

  const handlePDFExport = () => {
    if (!tableRef.current) {
      return;
    }

    exportTableAsPrintPDF('TeachEase - Students', tableRef.current.outerHTML);
    showToast('Print dialog opened for PDF export', 'info');
  };

  return (
    <Layout>
      <div>
        <PageHeader
          title="Students"
          description="Manage records, enrollment, and contact details in one place"
          actions={
            <>
              <button type="button" onClick={handleCSVExport} className="btn-secondary">
                <Download size={16} className="mr-2" />
                Export CSV
              </button>
              <button type="button" onClick={handlePDFExport} className="btn-secondary">
                <FileDown size={16} className="mr-2" />
                Export PDF
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="btn-primary"
              >
                <Plus size={18} className="mr-2" />
                Add Student
              </button>
            </>
          }
        />

        <div className="card mb-6">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by name, email, or roll number"
                />
              </div>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input-base md:w-64"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - Grade {cls.grade} {cls.section}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary md:w-48"
                onClick={() => setSortBy((current) => (current === 'rollNumber' ? 'name' : 'rollNumber'))}
              >
                <ArrowUpDown size={16} className="mr-2" />
                Sort: {sortBy === 'rollNumber' ? 'Roll Number' : 'Name'}
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">{filteredSummary}</p>
          </div>

          {loading ? (
            <LoadingState compact message="Loading students..." />
          ) : students.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No students found"
                description="Try changing your filters or add a new student."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table ref={tableRef} className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roll No.</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {students.map((student) => (
                    <tr key={student.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-800">{student.rollNumber || '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                        <Link to={`/students/${student.id}`} className="inline-flex items-center gap-2 text-teal-700 hover:underline">
                          {student.firstName} {student.lastName}
                          <Eye size={14} />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{student.email}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {student.className ? `${student.className} - ${student.grade} ${student.section}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{student.phone || '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(student)}
                            className="rounded-lg border border-slate-200 p-2 text-sky-700 transition hover:bg-sky-50"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(student.id)}
                            className="rounded-lg border border-slate-200 p-2 text-rose-700 transition hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-slate-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-base"
                  />
                </div>

                {!editingStudent && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                    <input
                      type="password"
                      required={!editingStudent}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-base"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Class</label>
                    <select
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                      className="input-base"
                    >
                      <option value="">Select Class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} - {cls.grade} {cls.section}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Roll Number</label>
                    <input
                      type="text"
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary flex-1"
                  >
                    {isSaving ? 'Saving...' : editingStudent ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="btn-secondary flex-1"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={confirmDeleteId !== null}
          title="Delete student?"
          description="This action removes the student record permanently."
          confirmLabel="Delete"
          tone="danger"
          isBusy={deletingId !== null}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={handleDelete}
        />
      </div>
    </Layout>
  );
};

export default Students;
