import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/attendance_service.dart';
import '../services/grade_service.dart';
import '../services/student_service.dart';
import '../services/timetable_service.dart';
import '../state/auth_controller.dart';
import 'student_attendance_screen.dart';
import 'student_dashboard_screen.dart';
import 'student_grades_screen.dart';
import 'student_timetable_screen.dart';

class StudentHomeShell extends StatefulWidget {
  const StudentHomeShell({super.key});

  @override
  State<StudentHomeShell> createState() => _StudentHomeShellState();
}

class _StudentHomeShellState extends State<StudentHomeShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final studentId = auth.user!.id;

    final pages = [
      StudentDashboardScreen(
        studentId: studentId,
        studentService: context.read<StudentService>(),
        attendanceService: context.read<AttendanceService>(),
        gradeService: context.read<GradeService>(),
        timetableService: context.read<TimetableService>(),
      ),
      StudentAttendanceScreen(
        studentId: studentId,
        attendanceService: context.read<AttendanceService>(),
      ),
      StudentGradesScreen(
        studentId: studentId,
        gradeService: context.read<GradeService>(),
      ),
      StudentTimetableScreen(
        studentId: studentId,
        studentService: context.read<StudentService>(),
        timetableService: context.read<TimetableService>(),
      ),
    ];

    final labels = ['Dashboard', 'Attendance', 'Grades', 'Timetable'];

    return Scaffold(
      appBar: AppBar(
        title: Text('Student ${labels[index]}'),
        actions: [
          IconButton(
            tooltip: 'Logout',
            onPressed: () => context.read<AuthController>().logout(),
            icon: const Icon(Icons.logout),
          )
        ],
      ),
      body: pages[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.fact_check_outlined), label: 'Attendance'),
          NavigationDestination(icon: Icon(Icons.assessment_outlined), label: 'Grades'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Timetable'),
        ],
      ),
    );
  }
}
