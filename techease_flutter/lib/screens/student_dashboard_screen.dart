import 'package:flutter/material.dart';

import '../models/student.dart';
import '../services/attendance_service.dart';
import '../services/grade_service.dart';
import '../services/student_service.dart';
import '../services/timetable_service.dart';

class StudentDashboardScreen extends StatefulWidget {
  final int studentId;
  final StudentService studentService;
  final AttendanceService attendanceService;
  final GradeService gradeService;
  final TimetableService timetableService;

  const StudentDashboardScreen({
    super.key,
    required this.studentId,
    required this.studentService,
    required this.attendanceService,
    required this.gradeService,
    required this.timetableService,
  });

  @override
  State<StudentDashboardScreen> createState() => _StudentDashboardScreenState();
}

class _StudentDashboardScreenState extends State<StudentDashboardScreen> {
  bool loading = true;
  String? error;
  Student? student;
  StudentAttendanceSummary? attendance;
  List<GradeRecord> grades = const [];
  List<TimetableEntry> todayTimetable = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final details = await widget.studentService.fetchStudentById(widget.studentId);
      final attendanceSummary = await widget.attendanceService.getAttendanceByStudent(widget.studentId);
      final gradeList = await widget.gradeService.fetchGradesByStudent(
        studentId: widget.studentId,
        classId: details.classId,
      );
      List<TimetableEntry> timetableList = const [];
      if (details.classId != null) {
        final classTimetable = await widget.timetableService.fetchByClass(details.classId!);
        final today = DateTime.now().weekday;
        timetableList = classTimetable.where((slot) => slot.dayOfWeek == today).toList();
        timetableList.sort((a, b) => a.startTime.compareTo(b.startTime));
      }
      setState(() {
        student = details;
        attendance = attendanceSummary;
        grades = gradeList;
        todayTimetable = timetableList;
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final averageGrade = grades.isEmpty
        ? 0.0
        : grades.map((g) => g.percentage).reduce((a, b) => a + b) / grades.length;

    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          Card(
            color: const Color(0xFF0F766E),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Student Dashboard', style: TextStyle(color: Colors.white70)),
                  const SizedBox(height: 4),
                  Text(
                    student?.fullName ?? 'Student',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 24),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${student?.className ?? '-'}  Grade ${student?.grade ?? '-'} ${student?.section ?? ''}',
                    style: const TextStyle(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _StatCard(label: 'Attendance', value: '${(attendance?.attendancePercentage ?? 0).toStringAsFixed(1)}%'),
              _StatCard(label: 'Grade Average', value: '${averageGrade.toStringAsFixed(1)}%'),
              _StatCard(label: 'Total Exams', value: grades.length.toString()),
            ],
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Today\'s Timetable', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  if (todayTimetable.isEmpty)
                    const Text('No classes scheduled for today.')
                  else
                    ...todayTimetable.map(
                      (slot) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(child: Text(slot.subjectName ?? 'Subject')),
                            Text('${slot.startTime} - ${slot.endTime}'),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Recent Grades', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  if (grades.isEmpty)
                    const Text('No grade records yet.')
                  else
                    ...grades.take(5).map(
                      (g) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(child: Text('${g.subjectName} • ${g.examTypeName}')),
                            Text('${g.marksObtained.toStringAsFixed(0)}/${g.maxMarks.toStringAsFixed(0)}'),
                            const SizedBox(width: 8),
                            Text(g.grade, style: const TextStyle(fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;

  const _StatCard({required this.label, required this.value});

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
              Text(label, style: const TextStyle(color: Colors.black54, fontSize: 12)),
              const SizedBox(height: 4),
              Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }
}
