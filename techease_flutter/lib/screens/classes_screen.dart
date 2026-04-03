import 'package:flutter/material.dart';

import '../models/class_room.dart';
import '../models/student.dart';
import '../services/api_client.dart';
import '../services/class_service.dart';

class ClassesScreen extends StatefulWidget {
  final ClassService classService;

  const ClassesScreen({super.key, required this.classService});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  bool loading = true;
  List<ClassRoom> classes = const [];
  String? error;

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
      final list = await widget.classService.fetchClasses();
      setState(() => classes = list);
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

  Future<void> _openClassDetails(ClassRoom item) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: Text(item.name),
          content: FutureBuilder<(ClassRoom, List<Student>)>(
            future: () async {
              final details = await widget.classService.fetchClassById(item.id);
              final students = await widget.classService.fetchClassStudents(item.id);
              return (details, students);
            }(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SizedBox(
                  height: 140,
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              if (snapshot.hasError) {
                final err = snapshot.error;
                final message = err is ApiException ? err.message : err.toString();
                return Text(message);
              }

              final data = snapshot.data;
              if (data == null) {
                return const Text('Class details are not available.');
              }

              final details = data.$1;
              final students = data.$2;

              return SizedBox(
                width: 360,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Grade ${details.grade} ${details.section}'),
                      const SizedBox(height: 6),
                      Text('Academic Year: ${details.academicYear ?? '-'}'),
                      const SizedBox(height: 6),
                      Text('Room: ${details.roomNumber ?? '-'}'),
                      const SizedBox(height: 6),
                      Text(
                        'Teacher: ${details.teacherFirstName ?? '-'} ${details.teacherLastName ?? ''}'.trim(),
                      ),
                      const SizedBox(height: 6),
                      Text('Students: ${students.length}'),
                      const SizedBox(height: 12),
                      const Text('Student List', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (students.isEmpty)
                        const Text('No students found in this class.')
                      else
                        ...students.take(20).map(
                          (student) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              '${student.fullName}  ${student.rollNumber != null ? '• ${student.rollNumber}' : ''}',
                            ),
                          ),
                        ),
                      if (students.length > 20)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            '+ ${students.length - 20} more students',
                            style: const TextStyle(color: Colors.black54),
                          ),
                        ),
                    ],
                  ),
                ),
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
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return Center(child: Text(error!));
    if (classes.isEmpty) return const Center(child: Text('No classes available.'));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: classes.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final item = classes[index];
          return Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.class_)),
              title: Text(item.name),
              subtitle: Text('Grade ${item.grade} ${item.section}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _openClassDetails(item),
            ),
          );
        },
      ),
    );
  }
}
