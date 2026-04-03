export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'teacher' | 'student' | 'admin';
  phone?: string;
  profileImage?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Class {
  id: number;
  name: string;
  grade: string;
  section: string;
  academicYear: string;
  teacherId?: number;
  teacherFirstName?: string;
  teacherLastName?: string;
  roomNumber?: string;
  studentCount?: number;
  createdAt?: string;
}

export interface Student {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImage?: string;
  rollNumber?: string;
  enrollmentStatus?: string;
  enrollmentDate?: string;
  classId?: number;
  className?: string;
  grade?: string;
  section?: string;
}

export interface Attendance {
  id: number;
  studentId: number;
  classId: number;
  subjectId: number;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  subjectName?: string;
}

export interface Grade {
  id: number;
  studentId: number;
  classId: number;
  subjectId: number;
  examTypeId: number;
  marksObtained: number;
  maxMarks: number;
  grade: string;
  examDate?: string;
  remarks?: string;
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  subjectName?: string;
  examTypeName?: string;
  percentage?: number;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface ExamType {
  id: number;
  name: string;
  description?: string;
  weightage?: number;
}

export interface Timetable {
  id: number;
  classId: number;
  subjectId: number;
  teacherId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomNumber?: string;
  subjectName?: string;
  className?: string;
  grade?: string;
  section?: string;
  teacherFirstName?: string;
  teacherLastName?: string;
}

export interface DashboardStats {
  totalClasses?: number;
  totalStudents?: number;
  todaysClasses?: number;
  attendanceMarkedToday?: number;
  enrolledClasses?: number;
  attendancePercentage?: number;
  averageGrade?: number;
  totalTeachers?: number;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendancePercentage: number;
}

export interface ClassAnalytics {
  attendanceStats: {
    totalStudents: number;
    totalAttendanceRecords: number;
    totalPresent: number;
    totalAbsent: number;
    attendancePercentage: number;
  };
  gradeDistribution: Array<{ grade: string; count: number }>;
  subjectWisePerformance: Array<{
    subjectName: string;
    averagePercentage: number;
    totalAssessments: number;
  }>;
  topPerformers: Array<{
    id: number;
    firstName: string;
    lastName: string;
    rollNumber: string;
    averagePercentage: number;
  }>;
  weakStudents: Array<{
    id: number;
    firstName: string;
    lastName: string;
    rollNumber: string;
    averagePercentage: number;
    totalAssessments?: number;
    attendancePercentage?: number;
  }>;
  testPerformance?: Array<{
    id: number;
    title: string;
    status: string;
    testType: string;
    totalQuestions: number;
    totalSubmissions: number;
    gradedSubmissions: number;
    averagePercentage: number;
    minPercentage: number;
    maxPercentage: number;
    startTime?: string | null;
    endTime?: string | null;
  }>;
  testStats?: {
    totalTests: number;
    scheduledTests: number;
    activeTests: number;
    completedTests: number;
    studentsWithResults: number;
    gradedSubmissions: number;
  };
}
