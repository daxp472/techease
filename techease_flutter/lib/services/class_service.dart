import '../models/class_room.dart';
import '../models/student.dart';
import '../models/subject.dart';
import 'api_client.dart';

class ClassService {
  final ApiClient apiClient;

  ClassService(this.apiClient);

  Future<List<ClassRoom>> fetchClasses() async {
    final payload = await apiClient.get('/classes');
    final classes = (payload['classes'] as List<dynamic>? ?? const []);
    return classes
        .whereType<Map<String, dynamic>>()
        .map(ClassRoom.fromJson)
        .toList();
  }

  Future<List<Subject>> fetchSubjects() async {
    final payload = await apiClient.get('/classes/subjects');
    final subjects = (payload['subjects'] as List<dynamic>? ?? const []);
    return subjects
        .whereType<Map<String, dynamic>>()
        .map(Subject.fromJson)
        .toList();
  }

  Future<ClassRoom> fetchClassById(int classId) async {
    final payload = await apiClient.get('/classes/$classId');
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected class details response from server', 500);
    }

    final data = payload['class'];
    if (data is! Map<String, dynamic>) {
      throw ApiException('Class details not found in response', 404);
    }

    return ClassRoom.fromJson(data);
  }

  Future<List<Student>> fetchClassStudents(int classId) async {
    final payload = await apiClient.get('/classes/$classId/students');
    if (payload is! Map<String, dynamic>) {
      throw ApiException('Unexpected class students response from server', 500);
    }

    final students = (payload['students'] as List<dynamic>? ?? const []);
    return students
        .whereType<Map<String, dynamic>>()
        .map(Student.fromJson)
        .toList();
  }
}
