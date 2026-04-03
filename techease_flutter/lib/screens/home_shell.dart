import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/attendance_service.dart';
import '../services/class_service.dart';
import '../services/grade_service.dart';
import '../services/student_service.dart';
import '../services/timetable_service.dart';
import '../state/auth_controller.dart';
import 'analytics_screen.dart';
import 'attendance_screen.dart';
import 'classes_screen.dart';
import 'dashboard_screen.dart';
import 'grades_screen.dart';
import 'students_screen.dart';
import 'timetable_screen.dart';
import 'tools_screen.dart';

class HomeShell extends StatefulWidget {
  final ClassService classService;
  final StudentService studentService;
  final AttendanceService attendanceService;

  const HomeShell({
    super.key,
    required this.classService,
    required this.studentService,
    required this.attendanceService,
  });

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final user = auth.user!;

    final pages = [
      DashboardScreen(
        user: user,
        onQuickNavigate: (value) => setState(() => index = value),
      ),
      ClassesScreen(classService: widget.classService),
      StudentsScreen(studentService: widget.studentService),
      AnalyticsScreen(
        classService: widget.classService,
        studentService: widget.studentService,
        attendanceService: widget.attendanceService,
      ),
      AttendanceScreen(
        classService: widget.classService,
        studentService: widget.studentService,
        attendanceService: widget.attendanceService,
      ),
    ];

    final labels = ['Dashboard', 'Classes', 'Students', 'Analytics', 'Attendance'];

    void openMoreScreens() {
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (context) {
          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.assessment_outlined),
                  title: const Text('Grades & Reports'),
                  subtitle: const Text('Digital grading and report generation'),
                  onTap: () {
                    Navigator.of(context).pop();
                    Navigator.of(this.context).push(
                      MaterialPageRoute(
                        builder: (_) => GradesScreen(
                          classService: this.context.read<ClassService>(),
                          studentService: this.context.read<StudentService>(),
                          gradeService: this.context.read<GradeService>(),
                        ),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('Timetable'),
                  subtitle: const Text('Workload and schedule optimization'),
                  onTap: () {
                    Navigator.of(context).pop();
                    Navigator.of(this.context).push(
                      MaterialPageRoute(
                        builder: (_) => TimetableScreen(
                          timetableService: this.context.read<TimetableService>(),
                          classService: this.context.read<ClassService>(),
                        ),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.tune),
                  title: const Text('Tools'),
                  subtitle: const Text('Backend checks and usage guide'),
                  onTap: () {
                    Navigator.of(context).pop();
                    Navigator.of(this.context).push(
                      MaterialPageRoute(builder: (_) => const ToolsScreen()),
                    );
                  },
                ),
              ],
            ),
          );
        },
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(labels[index]),
        actions: [
          IconButton(
            tooltip: 'More Screens',
            onPressed: openMoreScreens,
            icon: const Icon(Icons.apps),
          ),
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
          NavigationDestination(icon: Icon(Icons.class_outlined), label: 'Classes'),
          NavigationDestination(icon: Icon(Icons.groups_2_outlined), label: 'Students'),
          NavigationDestination(icon: Icon(Icons.auto_graph), label: 'Analytics'),
          NavigationDestination(icon: Icon(Icons.fact_check_outlined), label: 'Attendance'),
        ],
      ),
    );
  }
}
