import mongoose from 'mongoose';

const documentPermissionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    permissions: {
      canView: { type: Boolean, default: true },
      canRemark: { type: Boolean, default: true },
      canSuggestChange: { type: Boolean, default: true },
      canDownload: { type: Boolean, default: true },
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    grantedAt: {
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

// Compound Unique Index: Prevents duplicate grants and enables O(1) instant lookup
documentPermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });

export const DocumentPermission = mongoose.model('DocumentPermission', documentPermissionSchema);
export default DocumentPermission;
