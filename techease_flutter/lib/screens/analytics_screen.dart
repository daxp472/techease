import 'package:flutter/material.dart';

import '../models/class_room.dart';
import '../models/student.dart';
import '../services/attendance_service.dart';
import '../services/class_service.dart';
import '../services/student_service.dart';

class AnalyticsScreen extends StatefulWidget {
  final ClassService classService;
  final StudentService studentService;
  final AttendanceService attendanceService;

  const AnalyticsScreen({
    super.key,
    required this.classService,
    required this.studentService,
    required this.attendanceService,
  });

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  bool loading = true;
  String? error;

  List<ClassRoom> classes = const [];
  List<Student> students = const [];
  List<AttendanceStat> classStats = const [];
  int? selectedClassId;

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final classList = await widget.classService.fetchClasses();
      final studentList = await widget.studentService.fetchStudents();
      final defaultClassId = classList.isNotEmpty ? classList.first.id : null;
      List<AttendanceStat> stats = const [];
      if (defaultClassId != null) {
        stats = await widget.attendanceService.getAttendanceStats(classId: defaultClassId);
      }

      setState(() {
        classes = classList;
        students = studentList;
        selectedClassId = defaultClassId;
        classStats = stats;
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _onClassChanged(int? classId) async {
    if (classId == null) return;
    setState(() {
      selectedClassId = classId;
      loading = true;
      error = null;
    });
    try {
      final stats = await widget.attendanceService.getAttendanceStats(classId: classId);
      setState(() => classStats = stats);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final avgAttendance = classStats.isEmpty
        ? 0.0
        : classStats.map((e) => e.attendancePercentage).reduce((a, b) => a + b) / classStats.length;

    if (loading && classes.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (error != null && classes.isEmpty) {
      return Center(child: Text(error!));
    }

    return RefreshIndicator(
      onRefresh: _loadOverview,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Performance Analytics',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text('Use this page to justify learning impact and class health with quick metrics.'),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MetricCard(title: 'Total Classes', value: classes.length.toString(), color: const Color(0xFF0F766E)),
              _MetricCard(title: 'Total Students', value: students.length.toString(), color: const Color(0xFF2563EB)),
              _MetricCard(
                title: 'Avg Attendance',
                value: '${avgAttendance.toStringAsFixed(1)}%',
                color: const Color(0xFFB45309),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Class Attendance Breakdown', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<int>(
                    initialValue: selectedClassId,
                    decoration: const InputDecoration(labelText: 'Class'),
                    items: classes
                        .map((item) => DropdownMenuItem<int>(value: item.id, child: Text(item.label)))
                        .toList(),
                    onChanged: _onClassChanged,
                  ),
                  const SizedBox(height: 12),
                  if (loading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 14),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (classStats.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Text('No attendance data available for this class yet.'),
                    )
                  else
                    ...classStats.take(12).map(
                      (stat) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ProgressTile(
                          label:
                              '${stat.fullName}${(stat.rollNumber ?? '').isNotEmpty ? ' (${stat.rollNumber})' : ''}',
                          percentage: stat.attendancePercentage,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Why This App Matters', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  SizedBox(height: 8),
                  Text('1. Faster classroom operations for teachers on mobile.'),
                  Text('2. Better student visibility through instant details and records.'),
                  Text('3. Higher accountability with attendance review and locking workflow.'),
                  Text('4. Better decision-making from class-level analytics and trends.'),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _MetricCard({required this.title, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.black54, fontSize: 12)),
              const SizedBox(height: 4),
              Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: color)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressTile extends StatelessWidget {
  final String label;
  final double percentage;

  const _ProgressTile({required this.label, required this.percentage});

  @override
  Widget build(BuildContext context) {
    final bounded = percentage.clamp(0, 100).toDouble();
    final tone = bounded >= 75
        ? const Color(0xFF0F766E)
        : bounded >= 50
            ? const Color(0xFFB45309)
            : const Color(0xFFB91C1C);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
            const SizedBox(width: 8),
            Text('${bounded.toStringAsFixed(1)}%', style: TextStyle(fontWeight: FontWeight.w700, color: tone)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 8,
            value: bounded / 100,
            color: tone,
            backgroundColor: const Color(0xFFE2E8F0),
          ),
        )
      ],
    );
  }
}
