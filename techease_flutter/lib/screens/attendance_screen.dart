import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/class_room.dart';
import '../models/student.dart';
import '../models/subject.dart';
import '../services/api_client.dart';
import '../services/attendance_service.dart';
import '../services/class_service.dart';
import '../services/student_service.dart';

class AttendanceScreen extends StatefulWidget {
  final ClassService classService;
  final StudentService studentService;
  final AttendanceService attendanceService;

  const AttendanceScreen({
    super.key,
    required this.classService,
    required this.studentService,
    required this.attendanceService,
  });

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<ClassRoom> classes = const [];
  List<Subject> subjects = const [];
  List<Student> students = const [];
  List<AttendanceInput> entries = const [];

  int? selectedClassId;
  int? selectedSubjectId;
  DateTime selectedDate = DateTime.now();

  bool loading = true;
  bool saving = false;
  bool isAttendanceLocked = false;
  String? error;

  bool get _isToday {
    final now = DateTime.now();
    return selectedDate.year == now.year && selectedDate.month == now.month && selectedDate.day == now.day;
  }

  @override
  void initState() {
    super.initState();
    _loadBase();
  }

  Future<void> _loadBase() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final classList = await widget.classService.fetchClasses();
      final subjectList = await widget.classService.fetchSubjects();
      setState(() {
        classes = classList;
        subjects = subjectList;
      });
    } catch (e) {
      if (e is ApiException) {
        setState(() => error = e.message);
      } else {
        setState(() => error = e.toString());
      }
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _loadStudents() async {
    if (selectedClassId == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await widget.studentService.fetchStudents(classId: selectedClassId);
      final statusByStudent = await widget.attendanceService.getAttendanceStatusByClass(
        classId: selectedClassId!,
        date: selectedDate,
        subjectId: selectedSubjectId,
      );
      final locked = await widget.attendanceService.getLockStatus(
        classId: selectedClassId!,
        date: selectedDate,
      );

      setState(() {
        students = list;
        isAttendanceLocked = locked;
        entries = list
            .map(
              (s) => AttendanceInput(
                student: s,
                status: statusByStudent[s.id] ?? 'present',
              ),
            )
            .toList();
      });
    } catch (e) {
      if (e is ApiException) {
        setState(() => error = e.message);
      } else {
        setState(() => error = e.toString());
      }
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDate: selectedDate,
    );
    if (picked != null) {
      setState(() => selectedDate = picked);
      if (selectedClassId != null) {
        await _loadStudents();
      }
    }
  }

  Future<void> _submitWithReview() async {
    if (selectedClassId == null || selectedSubjectId == null || entries.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select class, subject, and students first.')),
      );
      return;
    }

    if (!_isToday) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attendance is editable only for today.')),
      );
      return;
    }

    if (isAttendanceLocked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attendance is already submitted and locked for this date.')),
      );
      return;
    }

    final summary = {
      'present': entries.where((e) => e.status == 'present').length,
      'absent': entries.where((e) => e.status == 'absent').length,
      'late': entries.where((e) => e.status == 'late').length,
      'total': entries.length,
    };

    final shouldSubmit = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Review Attendance'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Date: ${DateFormat('yyyy-MM-dd').format(selectedDate)}'),
              const SizedBox(height: 8),
              Text('Present: ${summary['present']}'),
              Text('Absent: ${summary['absent']}'),
              Text('Late: ${summary['late']}'),
              Text('Total: ${summary['total']}'),
              const SizedBox(height: 10),
              const Text(
                'Please review once. After confirm, attendance will be submitted and locked for this class/date.',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Check Again'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Confirm Submit'),
            ),
          ],
        );
      },
    );

    if (shouldSubmit != true) {
      return;
    }

    setState(() => saving = true);
    try {
      await widget.attendanceService.markBulkAttendance(
        classId: selectedClassId!,
        subjectId: selectedSubjectId!,
        date: selectedDate,
        entries: entries,
      );
      await widget.attendanceService.lockAttendance(
        classId: selectedClassId!,
        date: selectedDate,
      );
      if (!mounted) return;
      setState(() => isAttendanceLocked = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attendance submitted and locked successfully.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading && classes.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (error != null && classes.isEmpty) {
      return Center(child: Text(error!));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                DropdownButtonFormField<int>(
                  initialValue: selectedClassId,
                  items: classes
                      .map((item) => DropdownMenuItem(value: item.id, child: Text(item.label)))
                      .toList(),
                  decoration: const InputDecoration(labelText: 'Class'),
                  onChanged: (value) {
                    setState(() {
                      selectedClassId = value;
                      isAttendanceLocked = false;
                    });
                    _loadStudents();
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  initialValue: selectedSubjectId,
                  items: subjects
                      .map((item) => DropdownMenuItem(value: item.id, child: Text(item.label)))
                      .toList(),
                  decoration: const InputDecoration(labelText: 'Subject'),
                  onChanged: (value) {
                    setState(() => selectedSubjectId = value);
                    if (selectedClassId != null) {
                      _loadStudents();
                    }
                  },
                ),
                const SizedBox(height: 10),
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(12),
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Date'),
                    child: Text(DateFormat('yyyy-MM-dd').format(selectedDate)),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        if (selectedClassId != null && !_isToday)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(
              'Attendance is read-only for selected date. Only today can be edited.',
              style: TextStyle(color: Colors.orange),
            ),
          ),
        if (selectedClassId != null && isAttendanceLocked)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(
              'Attendance already submitted and locked for this class/date.',
              style: TextStyle(color: Colors.green),
            ),
          ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(error!, style: const TextStyle(color: Colors.red)),
          ),
        if (!loading && selectedClassId != null && entries.isEmpty)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text('No students found in this class.'),
          ),
        ...entries.map((entry) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.student.fullName, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(entry.student.rollNumber ?? '-', style: const TextStyle(color: Colors.black54)),
                    const SizedBox(height: 10),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'present', label: Text('Present')),
                        ButtonSegment(value: 'absent', label: Text('Absent')),
                        ButtonSegment(value: 'late', label: Text('Late')),
                      ],
                      selected: {entry.status},
                      onSelectionChanged: (value) {
                        if (isAttendanceLocked || !_isToday) {
                          return;
                        }
                        setState(() => entry.status = value.first);
                      },
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: (saving || isAttendanceLocked || !_isToday) ? null : _submitWithReview,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(saving ? 'Submitting...' : 'Review & Submit Attendance'),
          ),
        )
      ],
    );
  }
}
