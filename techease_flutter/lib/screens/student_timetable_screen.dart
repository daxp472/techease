import 'package:flutter/material.dart';

import '../models/student.dart';
import '../services/student_service.dart';
import '../services/timetable_service.dart';

class StudentTimetableScreen extends StatefulWidget {
  final int studentId;
  final StudentService studentService;
  final TimetableService timetableService;

  const StudentTimetableScreen({
    super.key,
    required this.studentId,
    required this.studentService,
    required this.timetableService,
  });

  @override
  State<StudentTimetableScreen> createState() => _StudentTimetableScreenState();
}

class _StudentTimetableScreenState extends State<StudentTimetableScreen> {
  bool loading = true;
  String? error;
  Student? student;
  List<TimetableEntry> entries = const [];

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
      if (details.classId == null) {
        setState(() {
          student = details;
          entries = const [];
        });
      } else {
        final list = await widget.timetableService.fetchByClass(details.classId!);
        setState(() {
          student = details;
          entries = list;
        });
      }
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  String _dayLabel(int value) {
    const days = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      0: 'Sunday',
    };
    return days[value] ?? 'Day $value';
  }

  @override
  Widget build(BuildContext context) {
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
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                'Class: ${student?.className ?? '-'} • Grade ${student?.grade ?? '-'} ${student?.section ?? ''}',
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (entries.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text('No timetable available yet.'),
              ),
            )
          else
            ...entries.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    title: Text('${item.subjectName ?? 'Subject'} • ${_dayLabel(item.dayOfWeek)}'),
                    subtitle: Text('${item.startTime} - ${item.endTime}${item.roomNumber != null ? ' • Room ${item.roomNumber}' : ''}'),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
