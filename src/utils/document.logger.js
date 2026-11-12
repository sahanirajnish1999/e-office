import { DocumentLog } from '../models/document.log.model.js';

/**
 * Record an audit log entry for a document
 */
export const recordDocumentLog = async ({
  documentId,
  user,
  action,
  description,
  details = {},
}) => {
  try {
    return await DocumentLog.create({
      documentId,
      performedBy: user.id || user._id,
      performerName: user.name || user.email || 'User',
      performerRole: user.role || 'employee',
      action,
      description,
      details,
    });
  } catch (error) {
    console.error('Failed to write document audit log:', error.message);
  }
};
