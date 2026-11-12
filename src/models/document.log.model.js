import mongoose from 'mongoose';

const documentLogSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performerName: {
      type: String,
      required: true,
    },
    performerRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: [
        'CREATE',
        'UPDATE_METADATA',
        'UPDATE_PERMISSIONS',
        'FORWARD_TO_DEPARTMENT',
        'UPDATE_FORWARDED_PERMISSIONS',
        'ADD_REMARK',
        'ADD_STICKY',
        'ADD_NOTING',
        'APPROVE_NOTING',
        'CREATE_REPLICA',
        'REVIEW_REPLICA',
        'EMPLOYEE_REMOVED_ACCESS',
        'DEPT_ADMIN_DELETED_FILE',
        'WITHDRAW_FILE',
        'PERMANENT_DELETE',
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const DocumentLog = mongoose.model('DocumentLog', documentLogSchema);
export default DocumentLog;
