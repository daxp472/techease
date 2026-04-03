class ClassRoom {
  final int id;
  final String name;
  final String grade;
  final String section;
  final String? academicYear;
  final String? roomNumber;
  final String? teacherFirstName;
  final String? teacherLastName;
  final int? studentCount;

  ClassRoom({
    required this.id,
    required this.name,
    required this.grade,
    required this.section,
    this.academicYear,
    this.roomNumber,
    this.teacherFirstName,
    this.teacherLastName,
    this.studentCount,
  });

  String get label => '$name - Grade $grade $section';

  factory ClassRoom.fromJson(Map<String, dynamic> json) {
    return ClassRoom(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: (json['name'] ?? '').toString(),
      grade: (json['grade'] ?? '').toString(),
      section: (json['section'] ?? '').toString(),
      academicYear: (json['academicYear'] ?? json['academic_year'])?.toString(),
      roomNumber: (json['roomNumber'] ?? json['room_number'])?.toString(),
      teacherFirstName: (json['teacherFirstName'] ?? json['teacher_first_name'])?.toString(),
      teacherLastName: (json['teacherLastName'] ?? json['teacher_last_name'])?.toString(),
      studentCount: (json['studentCount'] as num?)?.toInt(),
    );
  }
}
