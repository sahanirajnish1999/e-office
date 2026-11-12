import mongoose from 'mongoose';

const documentReplicaSchema = new mongoose.Schema(
  {
    parentDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    suggestedByName: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Replica title is required'],
      trim: true,
    },
    proposedChanges: {
      type: String,
      required: [true, 'Proposed changes description is required'],
      trim: true,
    },
    revisedOriginalName: String,
    revisedStoredFilename: String,
    revisedFilePath: String,
    revisedFileUrl: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedByName: String,
    reviewNotes: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedAt: Date,
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

export const DocumentReplica = mongoose.model('DocumentReplica', documentReplicaSchema);
export default DocumentReplica;
