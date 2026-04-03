import 'package:intl/intl.dart';

import '../models/student.dart';
import 'api_client.dart';

class AttendanceService {
  final ApiClient apiClient;

  AttendanceService(this.apiClient);

  Future<void> markBulkAttendance({
    required int classId,
    required int subjectId,
    required DateTime date,
    required List<AttendanceInput> entries,
  }) async {
    final formattedDate = DateFormat('yyyy-MM-dd').format(date);
    await apiClient.post('/attendance/bulk', body: {
      'attendanceRecords': entries
          .map((entry) => {
                'studentId': entry.student.id,
                'classId': classId,
                'subjectId': subjectId,
                'date': formattedDate,
                'status': entry.status,
                'remarks': entry.remarks,
              })
          .toList(),
    });
  }

  Future<void> lockAttendance({required int classId, required DateTime date}) async {
    final formattedDate = DateFormat('yyyy-MM-dd').format(date);
    await apiClient.post('/attendance/lock', body: {
      'classId': classId,
      'date': formattedDate,
    });
  }

  Future<bool> getLockStatus({required int classId, required DateTime date}) async {
    final formattedDate = DateFormat('yyyy-MM-dd').format(date);
    final payload = await apiClient.get('/attendance/lock-status', query: {
      'classId': classId,
      'date': formattedDate,
    });

    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected attendance lock response from server', 500);
    }

    return payload['locked'] == true;
  }

  Future<Map<int, String>> getAttendanceStatusByClass({
    required int classId,
    required DateTime date,
    int? subjectId,
  }) async {
    final formattedDate = DateFormat('yyyy-MM-dd').format(date);
    final query = <String, dynamic>{
      'classId': classId,
      'date': formattedDate,
    };
    if (subjectId != null) {
      query['subjectId'] = subjectId;
    }

    final payload = await apiClient.get('/attendance/class', query: query);
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected attendance response from server', 500);
    }

    final list = (payload['attendance'] as List<dynamic>? ?? const []);
    final statusMap = <int, String>{};
    for (final item in list) {
      if (item is! Map<String, dynamic>) continue;
      final studentId = (item['studentId'] as num?)?.toInt();
      final status = (item['status'] ?? '').toString();
      if (studentId != null && status.isNotEmpty) {
        statusMap[studentId] = status;
      }
    }

    return statusMap;
  }

  Future<List<AttendanceStat>> getAttendanceStats({required int classId}) async {
    final payload = await apiClient.get('/attendance/stats', query: {'classId': classId});
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected attendance stats response from server', 500);
    }

    final stats = (payload['statistics'] as List<dynamic>? ?? const []);
    return stats
        .whereType<Map<String, dynamic>>()
        .map(AttendanceStat.fromJson)
        .toList();
  }

  Future<StudentAttendanceSummary> getAttendanceByStudent(int studentId) async {
    final payload = await apiClient.get('/attendance/student/$studentId');
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected student attendance response from server', 500);
    }

    final attendance = (payload['attendance'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(StudentAttendanceRecord.fromJson)
        .toList();
    final statistics = (payload['statistics'] as Map<String, dynamic>? ?? <String, dynamic>{});

    return StudentAttendanceSummary(
      records: attendance,
      statistics: statistics,
    );
  }
}

class AttendanceInput {
  final Student student;
  String status;
  String? remarks;

  AttendanceInput({required this.student, this.status = 'present', this.remarks});
}

class AttendanceStat {
  final int studentId;
  final String firstName;
  final String lastName;
  final String? rollNumber;
  final double attendancePercentage;

  AttendanceStat({
    required this.studentId,
    required this.firstName,
    required this.lastName,
    required this.attendancePercentage,
    this.rollNumber,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory AttendanceStat.fromJson(Map<String, dynamic> json) {
    final percentageRaw = json['attendance_percentage'] ?? json['attendancePercentage'] ?? 0;
    final percentage = percentageRaw is num
        ? percentageRaw.toDouble()
        : double.tryParse(percentageRaw.toString()) ?? 0;

    return AttendanceStat(
      studentId: (json['student_id'] as num?)?.toInt() ?? 0,
      firstName: (json['first_name'] ?? json['firstName'] ?? '').toString(),
      lastName: (json['last_name'] ?? json['lastName'] ?? '').toString(),
      rollNumber: (json['roll_number'] ?? json['rollNumber'])?.toString(),
      attendancePercentage: percentage,
    );
  }
}

class StudentAttendanceRecord {
  final String date;
  final String status;
  final String? subjectName;
  final String? className;
  final String? grade;
  final String? section;

  StudentAttendanceRecord({
    required this.date,
    required this.status,
    this.subjectName,
    this.className,
    this.grade,
    this.section,
  });

  factory StudentAttendanceRecord.fromJson(Map<String, dynamic> json) {
    return StudentAttendanceRecord(
      date: (json['date'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      subjectName: (json['subject_name'] ?? json['subjectName'])?.toString(),
      className: (json['class_name'] ?? json['className'])?.toString(),
      grade: (json['grade'])?.toString(),
      section: (json['section'])?.toString(),
    );
  }
}

class StudentAttendanceSummary {
  final List<StudentAttendanceRecord> records;
  final Map<String, dynamic> statistics;

  StudentAttendanceSummary({required this.records, required this.statistics});

  double get attendancePercentage {
    final raw = statistics['attendance_percentage'] ?? statistics['attendancePercentage'] ?? 0;
    if (raw is num) return raw.toDouble();
    return double.tryParse(raw.toString()) ?? 0;
  }
}
