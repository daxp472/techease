import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { classAPI } from '../services/api';
import { Class } from '../types';
import { Plus, Users, Eye } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { Link } from 'react-router-dom';

const Classes: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    section: '',
    academicYear: '2024-2025',
    roomNumber: ''
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await classAPI.getAll();
      setClasses(response.data.classes);
    } catch (error) {
      showToast('Error fetching classes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await classAPI.create(formData);
      setShowModal(false);
      fetchClasses();
      resetForm();
      showToast('Class created successfully', 'success');
    } catch (error) {
      showToast('Error creating class', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      grade: '',
      section: '',
      academicYear: '2024-2025',
      roomNumber: ''
    });
  };

  const filteredClasses = useMemo(
    () => classes.filter((cls) => `${cls.name} ${cls.grade} ${cls.section}`.toLowerCase().includes(search.toLowerCase())),
    [classes, search]
  );

  return (
    <Layout>
      <div>
        <PageHeader
          title="Classes"
          description="Organize classes, sections, and teacher assignments"
          actions={
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="btn-primary"
            >
              <Plus size={18} className="mr-2" />
              Add Class
            </button>
          }
        />

        <div className="card mb-6 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search class by name, grade, or section" />
        </div>

        {loading ? (
          <LoadingState compact message="Loading classes..." />
        ) : filteredClasses.length === 0 ? (
          <EmptyState title="No classes found" description="Add a class or adjust your search." />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredClasses.map((cls) => (
              <Link key={cls.id} to={`/classes/${cls.id}`} className="card p-6 block transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                    <p className="text-gray-600">
                      Grade {cls.grade} - Section {cls.section}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Users size={16} className="mr-2" />
                    <span>{cls.studentCount || 0} Students</span>
                  </div>
                  {cls.roomNumber && (
                    <div>Room: {cls.roomNumber}</div>
                  )}
                  {cls.teacherFirstName && (
                    <div>
                      Teacher: {cls.teacherFirstName} {cls.teacherLastName}
                    </div>
                  )}
                  <div className="border-t pt-2">
                    Academic Year: {cls.academicYear}
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                  Open class <Eye size={14} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add New Class</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Mathematics A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grade
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="A"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 text-white py-2 rounded-md hover:bg-primary-700"
                  >
                    Create Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
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

export default Classes;
