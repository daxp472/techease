import 'package:flutter/material.dart';

import '../models/class_room.dart';
import '../models/student.dart';
import '../models/subject.dart';
import '../services/class_service.dart';
import '../services/grade_service.dart';
import '../services/student_service.dart';

class GradesScreen extends StatefulWidget {
  final ClassService classService;
  final StudentService studentService;
  final GradeService gradeService;

  const GradesScreen({
    super.key,
    required this.classService,
    required this.studentService,
    required this.gradeService,
  });

  @override
  State<GradesScreen> createState() => _GradesScreenState();
}

class _GradesScreenState extends State<GradesScreen> {
  bool loading = true;
  bool saving = false;
  String? error;

  List<ClassRoom> classes = const [];
  List<Student> students = const [];
  List<Subject> subjects = const [];
  List<ExamType> examTypes = const [];
  List<GradeRecord> grades = const [];

  int? selectedClassId;
  int? selectedStudentId;
  ReportCard? reportCard;

  @override
  void initState() {
    super.initState();
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final classList = await widget.classService.fetchClasses();
      final subjectList = await widget.classService.fetchSubjects();
      final examTypeList = await widget.gradeService.fetchExamTypes();
      setState(() {
        classes = classList;
        subjects = subjectList;
        examTypes = examTypeList;
        selectedClassId = classList.isNotEmpty ? classList.first.id : null;
      });
      if (selectedClassId != null) {
        await _loadGrades();
        await _loadStudents();
      }
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _loadGrades() async {
    if (selectedClassId == null) return;
    final list = await widget.gradeService.fetchGradesByClass(classId: selectedClassId!);
    setState(() => grades = list);
  }

  Future<void> _loadStudents() async {
    if (selectedClassId == null) return;
    final list = await widget.studentService.fetchStudents(classId: selectedClassId);
    setState(() => students = list);
  }

  Future<void> _generateReport() async {
    if (selectedClassId == null || selectedStudentId == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final report = await widget.gradeService.fetchReportCard(
        studentId: selectedStudentId!,
        classId: selectedClassId!,
      );
      setState(() => reportCard = report);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  Future<void> _openAddGradeDialog() async {
    if (selectedClassId == null || students.isEmpty || subjects.isEmpty || examTypes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Load class, students, subjects, and exam types first.')),
      );
      return;
    }

    final studentId = ValueNotifier<int?>(students.first.id);
    final subjectId = ValueNotifier<int?>(subjects.first.id);
    final examTypeId = ValueNotifier<int?>(examTypes.first.id);
    final marksController = TextEditingController();
    final maxMarksController = TextEditingController(text: '100');
    DateTime examDate = DateTime.now();

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Add Grade'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ValueListenableBuilder<int?>(
                      valueListenable: studentId,
                      builder: (context, value, _) => DropdownButtonFormField<int>(
                        initialValue: value,
                        decoration: const InputDecoration(labelText: 'Student'),
                        items: students
                            .map((item) => DropdownMenuItem<int>(
                                  value: item.id,
                                  child: Text(item.fullName),
                                ))
                            .toList(),
                        onChanged: (v) => studentId.value = v,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ValueListenableBuilder<int?>(
                      valueListenable: subjectId,
                      builder: (context, value, _) => DropdownButtonFormField<int>(
                        initialValue: value,
                        decoration: const InputDecoration(labelText: 'Subject'),
                        items: subjects
                            .map((item) => DropdownMenuItem<int>(
                                  value: item.id,
                                  child: Text(item.label),
                                ))
                            .toList(),
                        onChanged: (v) => subjectId.value = v,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ValueListenableBuilder<int?>(
                      valueListenable: examTypeId,
                      builder: (context, value, _) => DropdownButtonFormField<int>(
                        initialValue: value,
                        decoration: const InputDecoration(labelText: 'Exam Type'),
                        items: examTypes
                            .map((item) => DropdownMenuItem<int>(
                                  value: item.id,
                                  child: Text(item.name),
                                ))
                            .toList(),
                        onChanged: (v) => examTypeId.value = v,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: marksController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Marks Obtained'),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: maxMarksController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Max Marks'),
                    ),
                    const SizedBox(height: 10),
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2100),
                          initialDate: examDate,
                        );
                        if (picked != null) {
                          setDialogState(() => examDate = picked);
                        }
                      },
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Exam Date'),
                        child: Text('${examDate.year}-${examDate.month.toString().padLeft(2, '0')}-${examDate.day.toString().padLeft(2, '0')}'),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
                FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
              ],
            );
          },
        );
      },
    );

    if (confirm != true) {
      return;
    }

    final marks = double.tryParse(marksController.text.trim());
    final maxMarks = double.tryParse(maxMarksController.text.trim());
    if (!mounted) return;
    if (studentId.value == null || subjectId.value == null || examTypeId.value == null || marks == null || maxMarks == null || maxMarks <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter valid grade details.')),
      );
      return;
    }

    setState(() => saving = true);
    try {
      await widget.gradeService.addGrade(
        studentId: studentId.value!,
        classId: selectedClassId!,
        subjectId: subjectId.value!,
        examTypeId: examTypeId.value!,
        marksObtained: marks,
        maxMarks: maxMarks,
        examDate: examDate,
      );
      await _loadGrades();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Grade added successfully.')),
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
    final average = grades.isEmpty
        ? 0.0
        : grades.map((e) => e.percentage).reduce((a, b) => a + b) / grades.length;

    if (loading && classes.isEmpty) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Grades & Reports')),
      body: ListView(
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
              child: Column(
                children: [
                  DropdownButtonFormField<int>(
                    initialValue: selectedClassId,
                    decoration: const InputDecoration(labelText: 'Class'),
                    items: classes
                        .map((item) => DropdownMenuItem<int>(value: item.id, child: Text(item.label)))
                        .toList(),
                    onChanged: (value) async {
                      setState(() {
                        selectedClassId = value;
                        reportCard = null;
                        selectedStudentId = null;
                        loading = true;
                      });
                      try {
                        await _loadGrades();
                        await _loadStudents();
                      } finally {
                        if (mounted) setState(() => loading = false);
                      }
                    },
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _StatBox(label: 'Entries', value: grades.length.toString()),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatBox(label: 'Average', value: '${average.toStringAsFixed(1)}%'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton.icon(
                      onPressed: saving ? null : _openAddGradeDialog,
                      icon: const Icon(Icons.add_chart),
                      label: const Text('Add Grade'),
                    ),
                  )
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
                  const Text('Student Report Generation', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<int>(
                    initialValue: selectedStudentId,
                    decoration: const InputDecoration(labelText: 'Student'),
                    items: students
                        .map((item) => DropdownMenuItem<int>(value: item.id, child: Text(item.fullName)))
                        .toList(),
                    onChanged: (value) => setState(() => selectedStudentId = value),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: loading ? null : _generateReport,
                    child: const Text('Generate Report Card Summary'),
                  ),
                  if (reportCard != null) ...[
                    const SizedBox(height: 10),
                    Text('Student: ${(reportCard!.student['firstName'] ?? '')} ${(reportCard!.student['lastName'] ?? '')}'),
                    Text('Class: ${(reportCard!.student['className'] ?? '-')} • Grade ${(reportCard!.student['grade'] ?? '-')} ${(reportCard!.student['section'] ?? '')}'),
                    Text('Overall Percentage: ${(reportCard!.overallStats['overallPercentage'] ?? reportCard!.overallStats['overall_percentage'] ?? '-')}%'),
                  ]
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (grades.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text('No grades available for this class yet.'),
              ),
            )
          else
            ...grades.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  child: ListTile(
                    title: Text('${item.fullName}  ${item.rollNumber != null ? '(${item.rollNumber})' : ''}'),
                    subtitle: Text('${item.subjectName} • ${item.examTypeName}'),
                    trailing: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('${item.marksObtained.toStringAsFixed(0)}/${item.maxMarks.toStringAsFixed(0)}'),
                        Text(item.grade, style: const TextStyle(fontWeight: FontWeight.w700)),
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

class _StatBox extends StatelessWidget {
  final String label;
  final String value;

  const _StatBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFF8FAFC),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}
