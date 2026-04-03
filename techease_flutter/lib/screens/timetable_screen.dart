import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/class_room.dart';
import '../models/subject.dart';
import '../services/class_service.dart';
import '../services/timetable_service.dart';
import '../state/auth_controller.dart';

class TimetableScreen extends StatefulWidget {
  final TimetableService timetableService;
  final ClassService classService;

  const TimetableScreen({
    super.key,
    required this.timetableService,
    required this.classService,
  });

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  bool loading = true;
  bool saving = false;
  String? error;

  List<ClassRoom> classes = const [];
  List<Subject> subjects = const [];
  List<TimetableEntry> entries = const [];
  int? selectedClassId;

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
      final auth = context.read<AuthController>();
      final role = auth.user?.role;
      final classList = await widget.classService.fetchClasses();
      final subjectList = await widget.classService.fetchSubjects();
      List<TimetableEntry> timetableList = const [];
      int? classId;

      if (role == 'teacher') {
        timetableList = await widget.timetableService.fetchByTeacher(auth.user?.id);
      } else {
        if (classList.isNotEmpty) {
          classId = classList.first.id;
          timetableList = await widget.timetableService.fetchByClass(classId);
        }
      }

      setState(() {
        classes = classList;
        subjects = subjectList;
        selectedClassId = classId;
        entries = timetableList;
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _loadByClass(int classId) async {
    setState(() {
      loading = true;
      selectedClassId = classId;
      error = null;
    });
    try {
      final list = await widget.timetableService.fetchByClass(classId);
      setState(() => entries = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _openAddSlotDialog() async {
    final auth = context.read<AuthController>();
    final role = auth.user?.role;
    if (role != 'teacher' && role != 'admin') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Only teacher/admin can add timetable slots.')),
      );
      return;
    }
    if (classes.isEmpty || subjects.isEmpty || auth.user == null) {
      return;
    }

    final classId = ValueNotifier<int?>(classes.first.id);
    final subjectId = ValueNotifier<int?>(subjects.first.id);
    int dayOfWeek = 1;
    final startController = TextEditingController(text: '09:00');
    final endController = TextEditingController(text: '10:00');
    final roomController = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Add Timetable Slot'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ValueListenableBuilder<int?>(
                    valueListenable: classId,
                    builder: (context, value, _) => DropdownButtonFormField<int>(
                      initialValue: value,
                      decoration: const InputDecoration(labelText: 'Class'),
                      items: classes
                          .map((item) => DropdownMenuItem<int>(value: item.id, child: Text(item.label)))
                          .toList(),
                      onChanged: (v) => classId.value = v,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ValueListenableBuilder<int?>(
                    valueListenable: subjectId,
                    builder: (context, value, _) => DropdownButtonFormField<int>(
                      initialValue: value,
                      decoration: const InputDecoration(labelText: 'Subject'),
                      items: subjects
                          .map((item) => DropdownMenuItem<int>(value: item.id, child: Text(item.label)))
                          .toList(),
                      onChanged: (v) => subjectId.value = v,
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<int>(
                    initialValue: dayOfWeek,
                    decoration: const InputDecoration(labelText: 'Day'),
                    items: const [
                      DropdownMenuItem(value: 1, child: Text('Monday')),
                      DropdownMenuItem(value: 2, child: Text('Tuesday')),
                      DropdownMenuItem(value: 3, child: Text('Wednesday')),
                      DropdownMenuItem(value: 4, child: Text('Thursday')),
                      DropdownMenuItem(value: 5, child: Text('Friday')),
                    ],
                    onChanged: (v) => setDialogState(() => dayOfWeek = v ?? 1),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: startController,
                    decoration: const InputDecoration(labelText: 'Start Time (HH:mm)'),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: endController,
                    decoration: const InputDecoration(labelText: 'End Time (HH:mm)'),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: roomController,
                    decoration: const InputDecoration(labelText: 'Room'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
            ],
          );
        });
      },
    );

    if (ok != true || classId.value == null || subjectId.value == null) {
      return;
    }

    setState(() => saving = true);
    try {
      await widget.timetableService.createEntry(
        classId: classId.value!,
        subjectId: subjectId.value!,
        teacherId: auth.user!.id,
        dayOfWeek: dayOfWeek,
        startTime: startController.text.trim(),
        endTime: endController.text.trim(),
        roomNumber: roomController.text.trim().isEmpty ? null : roomController.text.trim(),
      );
      if (auth.user?.role == 'teacher') {
        final list = await widget.timetableService.fetchByTeacher(auth.user!.id);
        setState(() => entries = list);
      } else {
        await _loadByClass(classId.value!);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Timetable slot added successfully.')),
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
    final role = context.watch<AuthController>().user?.role;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Timetable'),
        actions: [
          if (role == 'teacher' || role == 'admin')
            IconButton(
              onPressed: saving ? null : _openAddSlotDialog,
              tooltip: 'Add Slot',
              icon: const Icon(Icons.add_alarm),
            )
        ],
      ),
      body: loading && entries.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(error!, style: const TextStyle(color: Colors.red)),
                  ),
                if (role != 'teacher')
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: DropdownButtonFormField<int>(
                        initialValue: selectedClassId,
                        decoration: const InputDecoration(labelText: 'Class'),
                        items: classes
                            .map((item) => DropdownMenuItem<int>(value: item.id, child: Text(item.label)))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            _loadByClass(value);
                          }
                        },
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                if (entries.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(14),
                      child: Text('No timetable entries available.'),
                    ),
                  )
                else
                  ...entries.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            child: Text(item.dayOfWeek.toString()),
                          ),
                          title: Text('${item.subjectName ?? 'Subject'} • ${_dayLabel(item.dayOfWeek)}'),
                          subtitle: Text(
                            '${item.className ?? 'Class'} ${item.grade ?? ''} ${item.section ?? ''}\n${item.startTime} - ${item.endTime}${item.roomNumber != null ? ' • Room ${item.roomNumber}' : ''}',
                          ),
                          isThreeLine: true,
                        ),
                      ),
                    ),
                  )
              ],
            ),
    );
  }
}
