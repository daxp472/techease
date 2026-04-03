import React from 'react';
import { X, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface StudentAttendance {
  id: number;
  firstName: string;
  lastName: string;
  rollNumber: string;
  status: string;
}

interface AttendanceReviewModalProps {
  isOpen: boolean;
  attendanceData: StudentAttendance[];
  date: string;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const AttendanceReviewModal: React.FC<AttendanceReviewModalProps> = ({
  isOpen,
  attendanceData,
  date,
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 size={18} className="text-green-600" />;
      case 'absent':
        return <AlertCircle size={18} className="text-red-600" />;
      case 'late':
        return <Clock size={18} className="text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-50 border-l-4 border-green-600';
      case 'absent':
        return 'bg-red-50 border-l-4 border-red-600';
      case 'late':
        return 'bg-amber-50 border-l-4 border-amber-600';
      default:
        return 'bg-gray-50';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Review Attendance</h2>
            <p className="text-sm text-slate-600 mt-1">
              Date: <span className="font-medium">{new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {attendanceData && attendanceData.length > 0 ? (
            attendanceData.map((record) => (
              <div
                key={record.id}
                className={`p-4 rounded-xl flex items-center justify-between transition ${getStatusColor(record.status)}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {getStatusIcon(record.status)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {record.firstName} {record.lastName}
                    </p>
                    <p className="text-xs text-slate-600">
                      Roll No: {record.rollNumber}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadge(record.status)}`}>
                  {record.status}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              No attendance data to review
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3 justify-end bg-slate-50">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Submitting...
              </>
            ) : (
              'Confirm & Submit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReviewModal;
