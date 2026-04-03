import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

export const studentAPI = {
  getAll: (params?: any) => api.get('/students', { params }),
  getById: (id: number) => api.get(`/students/${id}`),
  create: (data: any) => api.post('/students', data),
  update: (id: number, data: any) => api.put(`/students/${id}`, data),
  delete: (id: number) => api.delete(`/students/${id}`),
  enroll: (data: any) => api.post('/students/enroll', data),
};

export const classAPI = {
  getAll: (params?: any) => api.get('/classes', { params }),
  getById: (id: number) => api.get(`/classes/${id}`),
  create: (data: any) => api.post('/classes', data),
  update: (id: number, data: any) => api.put(`/classes/${id}`, data),
  delete: (id: number) => api.delete(`/classes/${id}`),
  getStudents: (id: number) => api.get(`/classes/${id}/students`),
  getSubjects: () => api.get('/classes/subjects'),
  assignSubject: (data: any) => api.post('/classes/assign-subject', data),
};

export const attendanceAPI = {
  mark: (data: any) => api.post('/attendance', data),
  markBulk: (data: any) => api.post('/attendance/bulk', data),
  lock: (data: { classId: number; date: string }) => api.post('/attendance/lock', data),
  getLockStatus: (params: { classId: string; date: string }) => api.get('/attendance/lock-status', { params }),
  getByClass: (params: any) => api.get('/attendance/class', { params }),
  getByStudent: (studentId: number, params?: any) =>
    api.get(`/attendance/student/${studentId}`, { params }),
  getStats: (params: any) => api.get('/attendance/stats', { params }),
};

export const gradeAPI = {
  add: (data: any) => api.post('/grades', data),
  update: (id: number, data: any) => api.put(`/grades/${id}`, data),
  delete: (id: number) => api.delete(`/grades/${id}`),
  getByClass: (params: any) => api.get('/grades/class', { params }),
  getByStudent: (studentId: number, params?: any) =>
    api.get(`/grades/student/${studentId}`, { params }),
  getReportCard: (params: any) => api.get('/grades/report-card', { params }),
  getExamTypes: () => api.get('/grades/exam-types'),
};

export const timetableAPI = {
  create: (data: any) => api.post('/timetable', data),
  update: (id: number, data: any) => api.put(`/timetable/${id}`, data),
  delete: (id: number) => api.delete(`/timetable/${id}`),
  getByClass: (classId: number) => api.get(`/timetable/class/${classId}`),
  getByTeacher: (teacherId?: number) =>
    api.get(`/timetable/teacher${teacherId ? `/${teacherId}` : ''}`),
};

export const analyticsAPI = {
  getClassAnalytics: (classId: number) =>
    api.get(`/analytics/class/${classId}`),
  getStudentAnalytics: (studentId: number) =>
    api.get(`/analytics/student/${studentId}`),
  getDashboardStats: () => api.get('/analytics/dashboard'),
};

export const syllabusAPI = {
  create: (data: any) => api.post('/syllabus', data),
  getTeacherSyllabuses: () => api.get('/syllabus/teacher'),
  getByClass: (params: { classId: number; subjectId: number }) => api.get('/syllabus/class', { params }),
  getStudentView: (params: { classId: number }) => api.get('/syllabus/student-view', { params }),
  updateTopicStatus: (topicId: number, data: any) => api.patch(`/syllabus/topics/${topicId}/status`, data),
  delete: (syllabusId: number) => api.delete(`/syllabus/${syllabusId}`),
};

export const testAPI = {
  create: (data: any) => api.post('/tests', data),
  generateFromPDF: (data: any) => api.post('/tests/generate-from-pdf', data),
  addQuestion: (testId: number, data: any) => api.post(`/tests/${testId}/questions`, data),
  publish: (testId: number, data: any) => api.put(`/tests/${testId}/publish`, data),
  getByClass: (params: { classId: number }) => api.get('/tests/class', { params }),
  getById: (testId: number) => api.get(`/tests/${testId}`),
  submit: (testId: number, data: any) => api.post(`/tests/${testId}/submit`, data),
  getResults: (testId: number) => api.get(`/tests/${testId}/results`),
  getAnalytics: (testId: number) => api.get(`/tests/${testId}/analytics`),
};

export default api;
