import 'package:flutter/material.dart';

import '../models/student.dart';
import '../services/api_client.dart';
import '../services/student_service.dart';

class StudentsScreen extends StatefulWidget {
  final StudentService studentService;

  const StudentsScreen({super.key, required this.studentService});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  bool loading = true;
  List<Student> students = const [];
  String? error;
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
      final list = await widget.studentService.fetchStudents(search: query);
      setState(() => students = list);
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

  Future<void> _openStudentDetails(Student student) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: Text(student.fullName),
          content: FutureBuilder<Student>(
            future: widget.studentService.fetchStudentById(student.id),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SizedBox(
                  height: 120,
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              if (snapshot.hasError) {
                final message = snapshot.error is ApiException
                    ? (snapshot.error as ApiException).message
                    : snapshot.error.toString();
                return Text(message);
              }

              final details = snapshot.data;
              if (details == null) {
                return const Text('No student details available.');
              }

              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Email: ${details.email}'),
                  const SizedBox(height: 6),
                  Text('Phone: ${details.phone ?? '-'}'),
                  const SizedBox(height: 6),
                  Text('Roll Number: ${details.rollNumber ?? '-'}'),
                  const SizedBox(height: 6),
                  Text(
                    'Class: ${details.className ?? '-'}'
                    '${(details.grade ?? '').isNotEmpty ? ' (Grade ${details.grade})' : ''}'
                    '${(details.section ?? '').isNotEmpty ? ' - ${details.section}' : ''}',
                  ),
                  const SizedBox(height: 6),
                  Text('Enrollment: ${details.enrollmentStatus ?? '-'}'),
                ],
              );
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            )
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search students',
            ),
            onChanged: (value) => query = value,
            onSubmitted: (_) => _load(),
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
                  ? Center(child: Text(error!))
                  : students.isEmpty
                      ? const Center(child: Text('No students found.'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: students.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = students[index];
                          return Card(
                            child: ListTile(
                              leading: CircleAvatar(child: Text(item.firstName.isNotEmpty ? item.firstName[0] : '?')),
                              title: Text(item.fullName),
                              subtitle: Text(item.email),
                              trailing: Text(item.rollNumber ?? '-'),
                              onTap: () => _openStudentDetails(item),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
