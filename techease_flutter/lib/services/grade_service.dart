import 'package:intl/intl.dart';

import 'api_client.dart';

class GradeService {
  final ApiClient apiClient;

  GradeService(this.apiClient);

  Future<List<ExamType>> fetchExamTypes() async {
    final payload = await apiClient.get('/grades/exam-types');
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected exam types response from server', 500);
    }
    final examTypes = (payload['examTypes'] as List<dynamic>? ?? const []);
    return examTypes
        .whereType<Map<String, dynamic>>()
        .map(ExamType.fromJson)
        .toList();
  }

  Future<List<GradeRecord>> fetchGradesByClass({
    required int classId,
    int? subjectId,
    int? examTypeId,
  }) async {
    final query = <String, dynamic>{'classId': classId};
    if (subjectId != null) {
      query['subjectId'] = subjectId;
    }
    if (examTypeId != null) {
      query['examTypeId'] = examTypeId;
    }

    final payload = await apiClient.get('/grades/class', query: query);
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected grades response from server', 500);
    }

    final grades = (payload['grades'] as List<dynamic>? ?? const []);
    return grades
        .whereType<Map<String, dynamic>>()
        .map(GradeRecord.fromJson)
        .toList();
  }

  Future<List<GradeRecord>> fetchGradesByStudent({required int studentId, int? classId}) async {
    final query = <String, dynamic>{};
    if (classId != null) {
      query['classId'] = classId;
    }

    final payload = await apiClient.get('/grades/student/$studentId', query: query.isEmpty ? null : query);
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected student grades response from server', 500);
    }

    final grades = (payload['grades'] as List<dynamic>? ?? const []);
    return grades
        .whereType<Map<String, dynamic>>()
        .map(GradeRecord.fromJson)
        .toList();
  }

  Future<void> addGrade({
    required int studentId,
    required int classId,
    required int subjectId,
    required int examTypeId,
    required double marksObtained,
    required double maxMarks,
    required DateTime examDate,
    String? remarks,
  }) async {
    await apiClient.post('/grades', body: {
      'studentId': studentId,
      'classId': classId,
      'subjectId': subjectId,
      'examTypeId': examTypeId,
      'marksObtained': marksObtained,
      'maxMarks': maxMarks,
      'examDate': DateFormat('yyyy-MM-dd').format(examDate),
      'remarks': remarks,
    });
  }

  Future<void> updateGrade({
    required int id,
    required double marksObtained,
    required double maxMarks,
    required DateTime examDate,
    String? remarks,
  }) async {
    await apiClient.put('/grades/$id', body: {
      'marksObtained': marksObtained,
      'maxMarks': maxMarks,
      'examDate': DateFormat('yyyy-MM-dd').format(examDate),
      'remarks': remarks,
    });
  }

  Future<ReportCard> fetchReportCard({required int studentId, required int classId}) async {
    final payload = await apiClient.get('/grades/report-card', query: {
      'studentId': studentId,
      'classId': classId,
    });

    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected report card response from server', 500);
    }

    return ReportCard.fromJson(payload);
  }
}

class ExamType {
  final int id;
  final String name;
  final String? description;
  final double? weightage;

  ExamType({required this.id, required this.name, this.description, this.weightage});

  factory ExamType.fromJson(Map<String, dynamic> json) {
    final rawWeightage = json['weightage'];
    return ExamType(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: (json['name'] ?? '').toString(),
      description: (json['description'])?.toString(),
      weightage: rawWeightage is num ? rawWeightage.toDouble() : double.tryParse(rawWeightage?.toString() ?? ''),
    );
  }
}

class GradeRecord {
  final int id;
  final int studentId;
  final String firstName;
  final String lastName;
  final String? rollNumber;
  final String subjectName;
  final String examTypeName;
  final double marksObtained;
  final double maxMarks;
  final String grade;
  final String? examDate;

  GradeRecord({
    required this.id,
    required this.studentId,
    required this.firstName,
    required this.lastName,
    required this.subjectName,
    required this.examTypeName,
    required this.marksObtained,
    required this.maxMarks,
    required this.grade,
    this.rollNumber,
    this.examDate,
  });

  String get fullName => '$firstName $lastName'.trim();

  double get percentage => maxMarks <= 0 ? 0 : (marksObtained / maxMarks) * 100;

  factory GradeRecord.fromJson(Map<String, dynamic> json) {
    final marks = json['marksObtained'] ?? json['marks_obtained'] ?? 0;
    final max = json['maxMarks'] ?? json['max_marks'] ?? 0;

    return GradeRecord(
      id: (json['id'] as num?)?.toInt() ?? 0,
      studentId: (json['studentId'] as num?)?.toInt() ?? 0,
      firstName: (json['firstName'] ?? json['first_name'] ?? '').toString(),
      lastName: (json['lastName'] ?? json['last_name'] ?? '').toString(),
      rollNumber: (json['rollNumber'] ?? json['roll_number'])?.toString(),
      subjectName: (json['subjectName'] ?? json['subject_name'] ?? '-').toString(),
      examTypeName: (json['examTypeName'] ?? json['exam_type_name'] ?? '-').toString(),
      marksObtained: marks is num ? marks.toDouble() : (double.tryParse(marks.toString()) ?? 0),
      maxMarks: max is num ? max.toDouble() : (double.tryParse(max.toString()) ?? 0),
      grade: (json['grade'] ?? '-').toString(),
      examDate: (json['examDate'] ?? json['exam_date'])?.toString(),
    );
  }
}

class ReportCard {
  final Map<String, dynamic> student;
  final List<Map<String, dynamic>> grades;
  final List<Map<String, dynamic>> subjectWiseStats;
  final Map<String, dynamic> overallStats;

  ReportCard({
    required this.student,
    required this.grades,
    required this.subjectWiseStats,
    required this.overallStats,
  });

  factory ReportCard.fromJson(Map<String, dynamic> json) {
    return ReportCard(
      student: (json['student'] as Map<String, dynamic>? ?? <String, dynamic>{}),
      grades: ((json['grades'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList()),
      subjectWiseStats: ((json['subjectWiseStats'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList()),
      overallStats: (json['overallStats'] as Map<String, dynamic>? ?? <String, dynamic>{}),
    );
  }
}
