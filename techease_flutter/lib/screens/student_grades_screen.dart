import 'package:flutter/material.dart';

import '../services/grade_service.dart';

class StudentGradesScreen extends StatefulWidget {
  final int studentId;
  final GradeService gradeService;

  const StudentGradesScreen({
    super.key,
    required this.studentId,
    required this.gradeService,
  });

  @override
  State<StudentGradesScreen> createState() => _StudentGradesScreenState();
}

class _StudentGradesScreenState extends State<StudentGradesScreen> {
  bool loading = true;
  String? error;
  List<GradeRecord> grades = const [];
  String query = '';

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
      final list = await widget.gradeService.fetchGradesByStudent(studentId: widget.studentId);
      list.sort((a, b) => (b.examDate ?? '').compareTo(a.examDate ?? ''));
      setState(() => grades = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final avg = grades.isEmpty
        ? 0.0
        : grades.map((g) => g.percentage).reduce((a, b) => a + b) / grades.length;
    final filtered = grades
      .where((g) => '${g.subjectName} ${g.examTypeName}'.toLowerCase().contains(query.toLowerCase()))
      .toList();

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
                  Expanded(child: _Metric(label: 'Exam Records', value: grades.length.toString())),
                  Expanded(child: _Metric(label: 'Average Score', value: '${avg.toStringAsFixed(1)}%')),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search subject or exam type',
            ),
            onChanged: (value) => setState(() => query = value),
          ),
          const SizedBox(height: 10),
          if (filtered.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text('No grade records available.'),
              ),
            )
          else
            ...filtered.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    title: Text('${item.subjectName} • ${item.examTypeName}'),
                    subtitle: Text(item.examDate?.split('T').first ?? '-'),
                    trailing: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('${item.marksObtained.toStringAsFixed(0)}/${item.maxMarks.toStringAsFixed(0)}'),
                        Text(
                          '${item.grade} • ${item.percentage.toStringAsFixed(1)}%',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
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

class _Metric extends StatelessWidget {
  final String label;
  final String value;

  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
      ],
    );
  }
}
