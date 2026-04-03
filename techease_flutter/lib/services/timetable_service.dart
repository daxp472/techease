import 'api_client.dart';

class TimetableService {
  final ApiClient apiClient;

  TimetableService(this.apiClient);

  Future<List<TimetableEntry>> fetchByClass(int classId) async {
    final payload = await apiClient.get('/timetable/class/$classId');
    return _decodeList(payload);
  }

  Future<List<TimetableEntry>> fetchByTeacher([int? teacherId]) async {
    final path = teacherId == null ? '/timetable/teacher' : '/timetable/teacher/$teacherId';
    final payload = await apiClient.get(path);
    return _decodeList(payload);
  }

  Future<void> createEntry({
    required int classId,
    required int subjectId,
    required int teacherId,
    required int dayOfWeek,
    required String startTime,
    required String endTime,
    String? roomNumber,
  }) async {
    await apiClient.post('/timetable', body: {
      'classId': classId,
      'subjectId': subjectId,
      'teacherId': teacherId,
      'dayOfWeek': dayOfWeek,
      'startTime': startTime,
      'endTime': endTime,
      'roomNumber': roomNumber,
    });
  }

  Future<void> updateEntry({
    required int id,
    required int classId,
    required int subjectId,
    required int teacherId,
    required int dayOfWeek,
    required String startTime,
    required String endTime,
    String? roomNumber,
  }) async {
    await apiClient.put('/timetable/$id', body: {
      'classId': classId,
      'subjectId': subjectId,
      'teacherId': teacherId,
      'dayOfWeek': dayOfWeek,
      'startTime': startTime,
      'endTime': endTime,
      'roomNumber': roomNumber,
    });
  }

  List<TimetableEntry> _decodeList(dynamic payload) {
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected timetable response from server', 500);
    }

    final timetable = (payload['timetable'] as List<dynamic>? ?? const []);
    return timetable
        .whereType<Map<String, dynamic>>()
        .map(TimetableEntry.fromJson)
        .toList();
  }
}

class TimetableEntry {
  final int id;
  final int classId;
  final int subjectId;
  final int teacherId;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final String? roomNumber;
  final String? subjectName;
  final String? className;
  final String? grade;
  final String? section;

  TimetableEntry({
    required this.id,
    required this.classId,
    required this.subjectId,
    required this.teacherId,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.roomNumber,
    this.subjectName,
    this.className,
    this.grade,
    this.section,
  });

  factory TimetableEntry.fromJson(Map<String, dynamic> json) {
    return TimetableEntry(
      id: (json['id'] as num?)?.toInt() ?? 0,
      classId: (json['classId'] as num?)?.toInt() ?? 0,
      subjectId: (json['subjectId'] as num?)?.toInt() ?? 0,
      teacherId: (json['teacherId'] as num?)?.toInt() ?? 0,
      dayOfWeek: (json['dayOfWeek'] as num?)?.toInt() ?? 0,
      startTime: (json['startTime'] ?? json['start_time'] ?? '').toString(),
      endTime: (json['endTime'] ?? json['end_time'] ?? '').toString(),
      roomNumber: (json['roomNumber'] ?? json['room_number'])?.toString(),
      subjectName: (json['subjectName'] ?? json['subject_name'])?.toString(),
      className: (json['className'] ?? json['class_name'])?.toString(),
      grade: (json['grade'])?.toString(),
      section: (json['section'])?.toString(),
    );
  }
}
