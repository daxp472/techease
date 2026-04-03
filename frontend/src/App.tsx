import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/ToastContext';
import LoadingState from './components/ui/LoadingState';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Classes = lazy(() => import('./pages/Classes'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Grades = lazy(() => import('./pages/Grades'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Syllabus = lazy(() => import('./pages/Syllabus'));
const Tests = lazy(() => import('./pages/Tests'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const ClassDetail = lazy(() => import('./pages/ClassDetail'));
const TestAttempt = lazy(() => import('./pages/TestAttempt'));

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingState message="Getting your workspace ready..." />
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Suspense fallback={<LoadingState message="Loading page..." />}>
            <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/student" element={<Navigate to="/student/dashboard" />} />
          <Route
            path="/student/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <PrivateRoute>
                <Timetable />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/grades"
            element={
              <PrivateRoute>
                <Grades />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/syllabus"
            element={
              <PrivateRoute>
                <Syllabus />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/tests"
            element={
              <PrivateRoute>
                <Tests />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/tests/:id/attempt"
            element={
              <PrivateRoute>
                <TestAttempt />
              </PrivateRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/students"
            element={
              <PrivateRoute>
                <Students />
              </PrivateRoute>
            }
          />
          <Route
            path="/students/:id"
            element={
              <PrivateRoute>
                <StudentDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/classes"
            element={
              <PrivateRoute>
                <Classes />
              </PrivateRoute>
            }
          />
          <Route
            path="/classes/:id"
            element={
              <PrivateRoute>
                <ClassDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <PrivateRoute>
                <Attendance />
              </PrivateRoute>
            }
          />
          <Route
            path="/grades"
            element={
              <PrivateRoute>
                <Grades />
              </PrivateRoute>
            }
          />
          <Route
            path="/timetable"
            element={
              <PrivateRoute>
                <Timetable />
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <Analytics />
              </PrivateRoute>
            }
          />
          <Route
            path="/syllabus"
            element={
              <PrivateRoute>
                <Syllabus />
              </PrivateRoute>
            }
          />
          <Route
            path="/tests"
            element={
              <PrivateRoute>
                <Tests />
              </PrivateRoute>
            }
          />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Suspense>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
