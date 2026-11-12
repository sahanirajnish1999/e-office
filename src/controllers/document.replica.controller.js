import { DocumentReplica } from '../models/document.replica.model.js';
import { Document } from '../models/document.model.js';
import { recordDocumentLog } from '../utils/document.logger.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

/**
 * 1. Employee Creates Replica / Suggests Changes on an Uploaded File
 */
export const createReplica = async (req, res, next) => {
  try {
    const { id } = req.params; // parent document id
    const { title, proposedChanges } = req.body;

    if (!title || !proposedChanges) {
      return res.status(400).json({
        success: false,
        message: 'Replica title and proposedChanges description are required',
      });
    }

    const document = req.document; // verified by checkDocumentAccess middleware

    let revisedOriginalName;
    let revisedStoredFilename;
    let revisedFilePath;
    let revisedFileUrl;

    if (req.file) {
      revisedOriginalName = req.file.originalname;
      revisedStoredFilename = req.file.filename;
      revisedFilePath = req.file.path;
      revisedFileUrl = `/uploads/${req.file.filename}`;
    }

    const replica = await DocumentReplica.create({
      parentDocumentId: document._id,
      suggestedBy: req.user.id,
      suggestedByName: req.user.name || req.user.email,
      title: title.trim(),
      proposedChanges: proposedChanges.trim(),
      revisedOriginalName,
      revisedStoredFilename,
      revisedFilePath,
      revisedFileUrl,
      status: 'pending',
    });

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'CREATE_REPLICA',
      description: `Replica '${replica.title}' created by ${replica.suggestedByName} proposing changes`,
      details: { replicaId: replica._id, proposedChanges: replica.proposedChanges },
    });

    res.status(201).json({
      success: true,
      message: 'Replica created and submitted for admin review and approval',
      data: replica,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. List Replicas for a Document
 */
export const listReplicas = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, replicas] = await Promise.all([
      DocumentReplica.countDocuments({ parentDocumentId: id }),
      DocumentReplica.find({ parentDocumentId: id })
        .populate('suggestedBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: replicas,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Review Replica (Approve or Reject)
 * Admin / Super Admin
 */
export const reviewReplica = async (req, res, next) => {
  try {
    const { replicaId } = req.params;
    const { status, reviewNotes, applyChangesToOriginal } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"',
      });
    }

    if (req.user.role !== 'department_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Department Admins or Super Admins can review file replicas',
      });
    }

    const replica = await DocumentReplica.findById(replicaId);
    if (!replica) {
      return res.status(404).json({
        success: false,
        message: 'Replica not found',
      });
    }

    if (replica.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This replica proposal has already been ${replica.status}`,
      });
    }

    replica.status = status;
    replica.reviewedBy = req.user.id;
    replica.reviewedByName = req.user.name || req.user.email;
    replica.reviewNotes = reviewNotes || '';
    replica.reviewedAt = new Date();
    await replica.save();

    // Optionally apply revised file to original document if approved
    if (status === 'approved' && applyChangesToOriginal && replica.revisedFilePath) {
      const document = await Document.findById(replica.parentDocumentId);
      if (document) {
        document.originalName = replica.revisedOriginalName || document.originalName;
        document.storedFilename = replica.revisedStoredFilename || document.storedFilename;
        document.filePath = replica.revisedFilePath;
        document.fileUrl = replica.revisedFileUrl;
        await document.save();
      }
    }

    await recordDocumentLog({
      documentId: replica.parentDocumentId,
      user: req.user,
      action: 'REVIEW_REPLICA',
      description: `Replica '${replica.title}' was ${status} by ${replica.reviewedByName}`,
      details: { replicaId: replica._id, status, reviewNotes },
    });

    res.status(200).json({
      success: true,
      message: `Replica suggestion has been ${status}`,
      data: replica,
    });
  } catch (error) {
    next(error);
  }
};
