import '../models/student.dart';
import 'api_client.dart';

class StudentService {
  final ApiClient apiClient;

  StudentService(this.apiClient);

  Future<List<Student>> fetchStudents({int? classId, String? search}) async {
    final query = <String, dynamic>{};
    if (classId != null) query['classId'] = classId;
    if (search != null && search.trim().isNotEmpty) query['search'] = search.trim();

    final payload = await apiClient.get('/students', query: query.isEmpty ? null : query);
    final students = (payload['students'] as List<dynamic>? ?? const []);
    return students
        .whereType<Map<String, dynamic>>()
        .map(Student.fromJson)
        .toList();
  }

  Future<Student> fetchStudentById(int studentId) async {
    final payload = await apiClient.get('/students/$studentId');
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected student details response from server', 500);
    }

    final dynamic studentJson = payload['student'] ?? payload;
    if (studentJson is! Map<String, dynamic>) {
      throw ApiException('Student details not found in response', 500);
    }

    return Student.fromJson(studentJson);
  }
}
