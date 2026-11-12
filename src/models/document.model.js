import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    // 1. Basic Metadata
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    fileDate: {
      type: Date,
      default: Date.now,
    },
    subject: {
      type: String,
      required: [true, 'Subject/purpose of the file is required'],
      trim: true,
    },
    shelf: {
      type: String,
      default: 'General Rack',
      trim: true,
    },
    highlights: [
      {
        type: String,
        trim: true,
      },
    ],

    // 2. Physical File Information (from Multer)
    originalName: { type: String, required: true },
    storedFilename: { type: String, required: true },
    filePath: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },

    // 3. Primary Department & Access Control
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ['all_employees', 'department_only', 'specific_employees'],
      default: 'department_only',
    },

    // 4. Department Forwarding Array
    forwardedDepartments: [
      {
        departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
        forwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        forwardedAt: { type: Date, default: Date.now },
        targetAudience: {
          type: String,
          enum: ['all_employees', 'specific_employees'],
          default: 'all_employees',
        },
        isDeletedForDept: { type: Boolean, default: false },
        deletedAt: Date,
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    // 5. Remarks from Accessors
    remarks: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        userName: { type: String, required: true },
        comment: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 6. Virtual Sticky Notes (Colorful)
    stickies: [
      {
        color: {
          type: String,
          enum: ['yellow', 'blue', 'green', 'pink', 'orange', 'purple'],
          default: 'yellow',
        },
        note: { type: String, required: true, trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 7. Official Document Notings
    notings: [
      {
        text: { type: String, required: true, trim: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        isApproved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedByName: String,
        approvedAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // 8. Ownership, Deletion & Visibility Controls
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'withdrawn', 'archived'],
      default: 'active',
    },

    // Origin Department Deletion (Hidden for primary department, visible to Super Admin)
    isDeletedForOriginDept: { type: Boolean, default: false },
    originDeptDeletedAt: Date,
    originDeptDeletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Employee Self-Removal (Hides file for this specific employee only)
    hiddenForUsers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        removedAt: { type: Date, default: Date.now },
      },
    ],
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

// Indexes for fast searching
documentSchema.index({ title: 'text', subject: 'text' });
documentSchema.index({ departmentId: 1, fileDate: -1 });

export const Document = mongoose.model('Document', documentSchema);
export default Document;
