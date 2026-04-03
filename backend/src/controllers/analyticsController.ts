import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getClassAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { classId } = req.params;

    const attendanceStats = await query(
      `SELECT
        COUNT(DISTINCT student_id) as total_students,
        COUNT(*) as total_attendance_records,
        COUNT(*) FILTER (WHERE status = 'present') as total_present,
        COUNT(*) FILTER (WHERE status = 'absent') as total_absent,
        ROUND(COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 2) as attendance_percentage
       FROM attendance
       WHERE class_id = $1`,
      [classId]
    );

    const gradeDistribution = await query(
      `SELECT
        grade,
        COUNT(*) as count
       FROM grades
       WHERE class_id = $1
       GROUP BY grade
       ORDER BY grade`,
      [classId]
    );

    const subjectWisePerformance = await query(
      `SELECT
        s.name as subject_name,
        s.code as subject_code,
        COUNT(*) as total_assessments,
        ROUND(AVG(g.marks_obtained / g.max_marks * 100), 2) as average_percentage,
        MIN(g.marks_obtained / g.max_marks * 100) as min_percentage,
        MAX(g.marks_obtained / g.max_marks * 100) as max_percentage
       FROM grades g
       JOIN subjects s ON g.subject_id = s.id
       WHERE g.class_id = $1
       GROUP BY s.id, s.name, s.code
       ORDER BY s.name`,
      [classId]
    );

    const topPerformers = await query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        e.roll_number,
        COUNT(*) as total_assessments,
        ROUND(AVG(g.marks_obtained / g.max_marks * 100), 2) as average_percentage,
        SUM(g.marks_obtained) as total_marks,
        SUM(g.max_marks) as total_possible_marks
       FROM grades g
       JOIN users u ON g.student_id = u.id
       JOIN enrollments e ON u.id = e.student_id AND e.class_id = g.class_id
       WHERE g.class_id = $1
       GROUP BY u.id, u.first_name, u.last_name, e.roll_number
       HAVING COUNT(*) >= 3
       ORDER BY average_percentage DESC
       LIMIT 10`,
      [classId]
    );

    const weakStudents = await query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        e.roll_number,
        COALESCE(g.total_assessments, 0) as total_assessments,
        COALESCE(g.average_percentage, 0) as average_percentage,
        COALESCE(g.total_marks, 0) as total_marks,
        COALESCE(g.total_possible_marks, 0) as total_possible_marks
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN (
         SELECT
           student_id,
           class_id,
           COUNT(*) as total_assessments,
           ROUND(AVG(marks_obtained / NULLIF(max_marks, 0) * 100), 2) as average_percentage,
           SUM(marks_obtained) as total_marks,
           SUM(max_marks) as total_possible_marks
         FROM grades
         WHERE class_id = $1
         GROUP BY student_id, class_id
       ) g ON g.student_id = e.student_id AND g.class_id = e.class_id
       WHERE e.class_id = $1
         AND e.status = 'active'
         AND (
           COALESCE(g.average_percentage, 0) < 50
           OR COALESCE(g.total_assessments, 0) = 0
         )
       ORDER BY average_percentage ASC, total_assessments ASC, u.first_name ASC
       LIMIT 10`,
      [classId]
    );

    const monthlyTrend = await query(
      `SELECT
        DATE_TRUNC('month', exam_date) as month,
        ROUND(AVG(marks_obtained / max_marks * 100), 2) as average_percentage
       FROM grades
       WHERE class_id = $1 AND exam_date IS NOT NULL
       GROUP BY DATE_TRUNC('month', exam_date)
       ORDER BY month DESC
       LIMIT 6`,
      [classId]
    );

    const testPerformance = await query(
      `SELECT
         t.id,
         t.title,
         t.status,
         t.test_type,
         t.total_questions,
         t.start_time,
         t.end_time,
         COUNT(ts.id) as total_submissions,
         COUNT(ts.id) FILTER (WHERE ts.status = 'graded') as graded_submissions,
         COALESCE(ROUND(AVG(ts.percentage), 2), 0) as average_percentage,
         COALESCE(MIN(ts.percentage), 0) as min_percentage,
         COALESCE(MAX(ts.percentage), 0) as max_percentage
       FROM tests t
       LEFT JOIN test_submissions ts ON ts.test_id = t.id
       WHERE t.class_id = $1
       GROUP BY t.id, t.title, t.status, t.test_type, t.total_questions, t.start_time, t.end_time
       ORDER BY COALESCE(t.start_time, t.created_at) DESC, t.id DESC
       LIMIT 8`,
      [classId]
    );

    const testStats = await query(
      `SELECT
         COUNT(*) as total_tests,
         COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_tests,
         COUNT(*) FILTER (WHERE status = 'active') as active_tests,
         COUNT(*) FILTER (WHERE status = 'completed') as completed_tests,
         COUNT(DISTINCT ts.student_id) as students_with_results,
         COUNT(ts.id) FILTER (WHERE ts.status = 'graded') as graded_submissions
       FROM tests t
       LEFT JOIN test_submissions ts ON ts.test_id = t.id
       WHERE t.class_id = $1`,
      [classId]
    );

    res.json({
      attendanceStats: attendanceStats.rows[0],
      gradeDistribution: gradeDistribution.rows,
      subjectWisePerformance: subjectWisePerformance.rows,
      topPerformers: topPerformers.rows,
      weakStudents: weakStudents.rows,
      monthlyTrend: monthlyTrend.rows,
      testPerformance: testPerformance.rows,
      testStats: testStats.rows[0]
    });
  } catch (error) {
    console.error('Get class analytics error:', error);
    res.status(500).json({ message: 'Error fetching class analytics' });
  }
};

export const getStudentAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;

    const overallPerformance = await query(
      `SELECT
        COUNT(*) as total_assessments,
        ROUND(AVG(marks_obtained / max_marks * 100), 2) as average_percentage,
        SUM(marks_obtained) as total_marks,
        SUM(max_marks) as total_possible_marks,
        COUNT(*) FILTER (WHERE grade IN ('A+', 'A')) as excellent_grades,
        COUNT(*) FILTER (WHERE grade = 'F') as failed_grades
       FROM grades
       WHERE student_id = $1`,
      [studentId]
    );

    const subjectWisePerformance = await query(
      `SELECT
        s.name as subject_name,
        s.code as subject_code,
        COUNT(*) as total_assessments,
        ROUND(AVG(g.marks_obtained / g.max_marks * 100), 2) as average_percentage,
        MIN(g.marks_obtained / g.max_marks * 100) as min_percentage,
        MAX(g.marks_obtained / g.max_marks * 100) as max_percentage
       FROM grades g
       JOIN subjects s ON g.subject_id = s.id
       WHERE g.student_id = $1
       GROUP BY s.id, s.name, s.code
       ORDER BY average_percentage DESC`,
      [studentId]
    );

    const attendanceStats = await query(
      `SELECT
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        COUNT(*) FILTER (WHERE status = 'late') as late_days,
        ROUND(COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 2) as attendance_percentage
       FROM attendance
       WHERE student_id = $1`,
      [studentId]
    );

    const recentGrades = await query(
      `SELECT g.*, s.name as subject_name, et.name as exam_type_name,
              ROUND((g.marks_obtained / g.max_marks * 100), 2) as percentage
       FROM grades g
       LEFT JOIN subjects s ON g.subject_id = s.id
       LEFT JOIN exam_types et ON g.exam_type_id = et.id
       WHERE g.student_id = $1
       ORDER BY g.exam_date DESC, g.created_at DESC
       LIMIT 10`,
      [studentId]
    );

    const progressTrend = await query(
      `SELECT
        DATE_TRUNC('month', exam_date) as month,
        ROUND(AVG(marks_obtained / max_marks * 100), 2) as average_percentage
       FROM grades
       WHERE student_id = $1 AND exam_date IS NOT NULL
       GROUP BY DATE_TRUNC('month', exam_date)
       ORDER BY month DESC
       LIMIT 6`,
      [studentId]
    );

    res.json({
      overallPerformance: overallPerformance.rows[0],
      subjectWisePerformance: subjectWisePerformance.rows,
      attendanceStats: attendanceStats.rows[0],
      recentGrades: recentGrades.rows,
      progressTrend: progressTrend.rows
    });
  } catch (error) {
    console.error('Get student analytics error:', error);
    res.status(500).json({ message: 'Error fetching student analytics' });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole === 'teacher') {
      const myClasses = await query(
        'SELECT COUNT(*) as total_classes FROM classes WHERE teacher_id = $1',
        [userId]
      );

      const myStudents = await query(
        `SELECT COUNT(DISTINCT e.student_id) as total_students
         FROM classes c
         JOIN enrollments e ON c.id = e.class_id
         WHERE c.teacher_id = $1 AND e.status = 'active'`,
        [userId]
      );

      const todaysClasses = await query(
        `SELECT COUNT(*) as today_classes
         FROM timetable t
         WHERE t.teacher_id = $1 AND t.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)`,
        [userId]
      );

      const recentAttendance = await query(
        `SELECT COUNT(*) as records_today
         FROM attendance a
         JOIN classes c ON a.class_id = c.id
         WHERE c.teacher_id = $1 AND a.date = CURRENT_DATE`,
        [userId]
      );

      res.json({
        totalClasses: myClasses.rows[0].total_classes,
        totalStudents: myStudents.rows[0].total_students,
        todaysClasses: todaysClasses.rows[0].today_classes,
        attendanceMarkedToday: recentAttendance.rows[0].records_today
      });
    } else if (userRole === 'student') {
      const myClasses = await query(
        `SELECT COUNT(*) as enrolled_classes
         FROM enrollments
         WHERE student_id = $1 AND status = 'active'`,
        [userId]
      );

      const myAttendance = await query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*), 0) as attendance_percentage
         FROM attendance
         WHERE student_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );

      const myGrades = await query(
        `SELECT
          ROUND(AVG(marks_obtained / max_marks * 100), 2) as average_percentage
         FROM grades
         WHERE student_id = $1`,
        [userId]
      );

      res.json({
        enrolledClasses: myClasses.rows[0].enrolled_classes,
        attendancePercentage: myAttendance.rows[0].attendance_percentage || 0,
        averageGrade: myGrades.rows[0].average_percentage || 0
      });
    } else {
      const totalTeachers = await query(
        'SELECT COUNT(*) as total FROM users WHERE role = \'teacher\''
      );

      const totalStudents = await query(
        'SELECT COUNT(*) as total FROM users WHERE role = \'student\''
      );

      const totalClasses = await query(
        'SELECT COUNT(*) as total FROM classes'
      );

      res.json({
        totalTeachers: totalTeachers.rows[0].total,
        totalStudents: totalStudents.rows[0].total,
        totalClasses: totalClasses.rows[0].total
      });
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
};

export const getClassInterventionSignals = async (req: AuthRequest, res: Response) => {
  try {
    const { classId } = req.params;

    const lowThreshold = Number(req.query.lowThreshold ?? 50);
    const highThreshold = Number(req.query.highThreshold ?? 80);
    const topicThreshold = Number(req.query.topicThreshold ?? 60);
    const classThreshold = Number(req.query.classThreshold ?? 65);
    const attendanceThreshold = Number(req.query.attendanceThreshold ?? 75);

    const studentSignals = await query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         COALESCE(e.roll_number, '-') as roll_number,
         COALESCE(g.total_assessments, 0) as total_assessments,
         COALESCE(g.avg_percentage, 0) as overall_percentage,
         COALESCE(a.attendance_percentage, 0) as attendance_percentage
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN (
         SELECT
           student_id,
           class_id,
           COUNT(*) as total_assessments,
           ROUND(AVG(marks_obtained / NULLIF(max_marks, 0) * 100), 2) as avg_percentage
         FROM grades
         WHERE class_id = $1
         GROUP BY student_id, class_id
       ) g ON g.student_id = e.student_id AND g.class_id = e.class_id
       LEFT JOIN (
         SELECT
           student_id,
           class_id,
           ROUND(COUNT(*) FILTER (WHERE status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 2) as attendance_percentage
         FROM attendance
         WHERE class_id = $1
         GROUP BY student_id, class_id
       ) a ON a.student_id = e.student_id AND a.class_id = e.class_id
       WHERE e.class_id = $1
         AND e.status = 'active'
       ORDER BY overall_percentage ASC, u.first_name ASC`,
      [classId]
    );

    const topicSignals = await query(
      `SELECT
         s.id,
         s.name as topic_name,
         ROUND(AVG(g.marks_obtained / NULLIF(g.max_marks, 0) * 100), 2) as average_percentage,
         COUNT(*) as samples
       FROM grades g
       JOIN subjects s ON s.id = g.subject_id
       WHERE g.class_id = $1
       GROUP BY s.id, s.name
       ORDER BY average_percentage ASC, s.name ASC`,
      [classId]
    );

    const studentRows = studentSignals.rows.map((row: any) => {
      const overallPercentage = Number(row.overall_percentage ?? 0);
      const attendancePercentage = Number(row.attendance_percentage ?? 0);
      const totalAssessments = Number(row.total_assessments ?? 0);

      const reasons: string[] = [];
      if (totalAssessments === 0) {
        reasons.push('No assessments recorded yet');
      }
      if (overallPercentage < lowThreshold) {
        reasons.push(`Overall performance below ${lowThreshold}%`);
      }
      if (attendancePercentage < attendanceThreshold) {
        reasons.push(`Attendance below ${attendanceThreshold}%`);
      }

      let status: 'critical' | 'watchlist' | 'stable' = 'stable';
      if (overallPercentage < lowThreshold || attendancePercentage < attendanceThreshold) {
        status = 'critical';
      } else if (overallPercentage < highThreshold) {
        status = 'watchlist';
      }

      return {
        id: Number(row.id),
        firstName: row.first_name,
        lastName: row.last_name,
        rollNumber: row.roll_number,
        totalAssessments,
        overallPercentage,
        attendancePercentage,
        status,
        reasons
      };
    });

    const topicRows = topicSignals.rows.map((row: any) => {
      const averagePercentage = Number(row.average_percentage ?? 0);
      return {
        id: Number(row.id),
        topicName: row.topic_name,
        averagePercentage,
        samples: Number(row.samples ?? 0),
        isRisk: averagePercentage < topicThreshold
      };
    });

    const classAverage = studentRows.length > 0
      ? Number((studentRows.reduce((sum, row) => sum + row.overallPercentage, 0) / studentRows.length).toFixed(2))
      : 0;

    const criticalStudents = studentRows.filter((row) => row.status === 'critical');
    const watchlistStudents = studentRows.filter((row) => row.status === 'watchlist');
    const classRiskTopics = topicRows.filter((row) => row.isRisk);

    res.json({
      thresholds: {
        lowThreshold,
        highThreshold,
        topicThreshold,
        classThreshold,
        attendanceThreshold
      },
      classSummary: {
        totalStudents: studentRows.length,
        classAverage,
        classNeedsIntervention: classAverage < classThreshold || classRiskTopics.length > 0,
        criticalCount: criticalStudents.length,
        watchlistCount: watchlistStudents.length,
        riskTopicCount: classRiskTopics.length
      },
      students: studentRows,
      topics: topicRows,
      criticalStudents,
      watchlistStudents,
      classRiskTopics,
      guidance: {
        lowPerformanceRule: `Student overall below ${lowThreshold}% is treated as critical.`,
        highPerformanceRule: `Student overall at or above ${highThreshold}% is treated as stable.`,
        topicUnderstandingRule: `Topic average below ${topicThreshold}% indicates comprehension risk.`,
        classUnderstandingRule: `Class average below ${classThreshold}% indicates class-level intervention is needed.`
      }
    });
  } catch (error) {
    console.error('Get class intervention signals error:', error);
    res.status(500).json({ message: 'Error fetching intervention signals' });
  }
};
