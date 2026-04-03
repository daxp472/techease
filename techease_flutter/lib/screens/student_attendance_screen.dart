import 'package:flutter/material.dart';

import '../services/attendance_service.dart';

class StudentAttendanceScreen extends StatefulWidget {
  final int studentId;
  final AttendanceService attendanceService;

  const StudentAttendanceScreen({
    super.key,
    required this.studentId,
    required this.attendanceService,
  });

  @override
  State<StudentAttendanceScreen> createState() => _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends State<StudentAttendanceScreen> {
  bool loading = true;
  String? error;
  StudentAttendanceSummary? summary;

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
      final data = await widget.attendanceService.getAttendanceByStudent(widget.studentId);
      setState(() => summary = data);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final records = summary?.records ?? const <StudentAttendanceRecord>[];

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
              child: Row(
                children: [
                  Expanded(
                    child: _TopMetric(
                      label: 'Attendance %',
                      value: '${(summary?.attendancePercentage ?? 0).toStringAsFixed(1)}%',
                    ),
                  ),
                  Expanded(
                    child: _TopMetric(
                      label: 'Present',
                      value: (summary?.statistics['present_days'] ?? '0').toString(),
                    ),
                  ),
                  Expanded(
                    child: _TopMetric(
                      label: 'Absent',
                      value: (summary?.statistics['absent_days'] ?? '0').toString(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (records.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text('No attendance records available.'),
              ),
            )
          else
            ...records.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    title: Text(item.date.split('T').first),
                    subtitle: Text('${item.subjectName ?? '-'} • ${item.className ?? '-'}'),
                    trailing: Text(
                      item.status.toUpperCase(),
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: item.status == 'present'
                            ? const Color(0xFF0F766E)
                            : item.status == 'late'
                                ? const Color(0xFFB45309)
                                : const Color(0xFFB91C1C),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TopMetric extends StatelessWidget {
  final String label;
  final String value;

  const _TopMetric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ],
    );
  }
}
