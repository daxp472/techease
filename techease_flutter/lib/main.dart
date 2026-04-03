import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'screens/student_home_shell.dart';
import 'services/api_client.dart';
import 'services/attendance_service.dart';
import 'services/class_service.dart';
import 'services/grade_service.dart';
import 'services/student_service.dart';
import 'services/timetable_service.dart';
import 'state/auth_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = ApiClient();
  await apiClient.init();
  runApp(TeachEaseApp(apiClient: apiClient));
}

class TeachEaseApp extends StatelessWidget {
  final ApiClient apiClient;

  const TeachEaseApp({super.key, required this.apiClient});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthController(apiClient)..init(),
        ),
        Provider.value(value: apiClient),
        Provider(create: (_) => ClassService(apiClient)),
        Provider(create: (_) => StudentService(apiClient)),
        Provider(create: (_) => AttendanceService(apiClient)),
        Provider(create: (_) => GradeService(apiClient)),
        Provider(create: (_) => TimetableService(apiClient)),
      ],
      child: MaterialApp(
        title: 'TeachEase Mobile',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const AppBootstrap(),
      ),
    );
  }
}

class AppBootstrap extends StatelessWidget {
  const AppBootstrap({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();

    if (auth.initializing) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (auth.user == null) {
      return const LoginScreen();
    }

    if (auth.user?.role == 'student') {
      return const StudentHomeShell();
    }

    return HomeShell(
      classService: context.read<ClassService>(),
      studentService: context.read<StudentService>(),
      attendanceService: context.read<AttendanceService>(),
    );
  }
}
