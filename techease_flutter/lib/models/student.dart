class Student {
  final int id;
  final String firstName;
  final String lastName;
  final String email;
  final String? rollNumber;
  final int? classId;
  final String? phone;
  final String? className;
  final String? grade;
  final String? section;
  final String? enrollmentStatus;

  Student({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.rollNumber,
    this.classId,
    this.phone,
    this.className,
    this.grade,
    this.section,
    this.enrollmentStatus,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory Student.fromJson(Map<String, dynamic> json) {
    final classIdRaw = json['classId'] ?? json['class_id'] ?? json['classid'];
    return Student(
      id: (json['id'] as num?)?.toInt() ?? 0,
      firstName: (json['firstName'] ?? json['first_name'] ?? '').toString(),
      lastName: (json['lastName'] ?? json['last_name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      rollNumber: (json['rollNumber'] ?? json['roll_number'])?.toString(),
      classId: classIdRaw is num ? classIdRaw.toInt() : int.tryParse(classIdRaw?.toString() ?? ''),
      phone: (json['phone'])?.toString(),
      className: (json['className'] ?? json['class_name'])?.toString(),
      grade: (json['grade'])?.toString(),
      section: (json['section'])?.toString(),
      enrollmentStatus: (json['enrollmentStatus'] ?? json['enrollment_status'])?.toString(),
    );
  }
}
