import fs from 'node:fs';
import { Document } from '../models/document.model.js';
import { Department } from '../models/department.model.js';
import { DocumentLog } from '../models/document.log.model.js';
import { DocumentPermission } from '../models/document.permission.model.js';
import { recordDocumentLog } from '../utils/document.logger.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

/**
 * 1. Upload & Create Document
 * Admin / Super Admin
 */
export const createDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a file with the key "file"',
      });
    }

    const {
      title,
      fileDate,
      subject,
      shelf,
      highlights,
      departmentId,
      targetAudience,
      allowedUsers,
    } = req.body;

    if (!title || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Title and subject/purpose are required fields',
      });
    }

    // Determine target department
    let targetDeptId = departmentId;
    if (req.user.role === 'department_admin') {
      targetDeptId = req.user.departmentId;
    }

    if (!targetDeptId) {
      return res.status(400).json({
        success: false,
        message: 'A valid departmentId must be specified for this file',
      });
    }

    const dept = await Department.findById(targetDeptId);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: 'Target department does not exist',
      });
    }

    // Parse highlights if sent as JSON string or comma-separated string
    let parsedHighlights = [];
    if (highlights) {
      if (typeof highlights === 'string') {
        try {
          parsedHighlights = JSON.parse(highlights);
        } catch {
          parsedHighlights = highlights.split(',').map((h) => h.trim());
        }
      } else if (Array.isArray(highlights)) {
        parsedHighlights = highlights;
      }
    }

    // Parse allowedUsers if sent as string
    let parsedAllowedUsers = [];
    if (allowedUsers) {
      if (typeof allowedUsers === 'string') {
        try {
          parsedAllowedUsers = JSON.parse(allowedUsers);
        } catch {
          parsedAllowedUsers = [];
        }
      } else if (Array.isArray(allowedUsers)) {
        parsedAllowedUsers = allowedUsers;
      }
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Create Main Document (Stays ultra-lightweight: ~1-2 KB)
    const document = await Document.create({
      title,
      fileDate: fileDate ? new Date(fileDate) : new Date(),
      subject,
      shelf: shelf || 'General Rack',
      highlights: parsedHighlights,
      originalName: req.file.originalname,
      storedFilename: req.file.filename,
      filePath: req.file.path,
      fileUrl,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      departmentId: targetDeptId,
      targetAudience: targetAudience || 'department_only',
      createdBy: req.user.id,
    });

    // Pattern B: Bulk insert permissions into DocumentPermission collection
    if (parsedAllowedUsers.length > 0) {
      const permissionDocs = parsedAllowedUsers.map((u) => ({
        documentId: document._id,
        userId: u.userId,
        departmentId: targetDeptId,
        permissions: u.permissions || {
          canView: true,
          canRemark: true,
          canSuggestChange: true,
          canDownload: true,
        },
        grantedBy: req.user.id,
      }));

      await DocumentPermission.insertMany(permissionDocs, { ordered: false }).catch((err) => {
        console.warn('Some duplicate permission grants skipped:', err.message);
      });
    }

    // Record audit log
    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'CREATE',
      description: `Document '${document.title}' uploaded and created by ${req.user.name || req.user.email}`,
      details: {
        department: dept.name,
        shelf: document.shelf,
        targetAudience: document.targetAudience,
        grantedUsersCount: parsedAllowedUsers.length,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded and created successfully',
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Search & List Documents
 * Filter by Department, Date, Subject, Accessor, Shelf, Alphabetical (A-Z)
 */
export const searchAndListDocuments = async (req, res, next) => {
  try {
    const {
      departmentId,
      search,
      subject,
      shelf,
      accessorId,
      dateFrom,
      dateTo,
      sortAlphabetical,
      includeWithdrawn,
    } = req.query;

    const query = {};

    // 1. Base status filter
    if (includeWithdrawn !== 'true') {
      query.status = { $ne: 'withdrawn' };
    }

    // 2. Role-based scoping
    const userId = req.user.id;
    const userDeptId = req.user.departmentId;

    if (req.user.role === 'super_admin') {
      if (departmentId) {
        query.departmentId = departmentId;
      }
    } else if (req.user.role === 'department_admin') {
      query.$and = [
        { 'hiddenForUsers.userId': { $ne: userId } },
        {
          $or: [
            { departmentId: userDeptId, isDeletedForOriginDept: false },
            {
              forwardedDepartments: {
                $elemMatch: {
                  departmentId: userDeptId,
                  isDeletedForDept: false,
                },
              },
            },
          ],
        },
      ];
    } else {
      // Employee: Find document IDs where employee has individual permission via DocumentPermission
      const userPermittedDocIds = await DocumentPermission.distinct('documentId', {
        userId,
      });

      query.$and = [
        { 'hiddenForUsers.userId': { $ne: userId } },
        {
          $or: [
            // Origin department group files
            {
              departmentId: userDeptId,
              isDeletedForOriginDept: false,
              targetAudience: { $in: ['all_employees', 'department_only'] },
            },
            // Forwarded department group files
            {
              forwardedDepartments: {
                $elemMatch: {
                  departmentId: userDeptId,
                  isDeletedForDept: false,
                  targetAudience: 'all_employees',
                },
              },
            },
            // Directly granted individual permissions
            { _id: { $in: userPermittedDocIds } },
          ],
        },
      ];
    }

    // 3. Search text / subject
    if (search || subject) {
      const searchTerm = search || subject;
      query.$or = query.$or || [];
      query.title = { $regex: searchTerm, $options: 'i' };
    }

    // 4. Shelf filter
    if (shelf) {
      query.shelf = { $regex: shelf, $options: 'i' };
    }

    // 5. Accessor filter (Find files permitted to a specific user)
    if (accessorId) {
      const accessorPermittedDocIds = await DocumentPermission.distinct('documentId', {
        userId: accessorId,
      });
      query._id = { $in: accessorPermittedDocIds };
    }

    // 6. Date range filter
    if (dateFrom || dateTo) {
      query.fileDate = {};
      if (dateFrom) query.fileDate.$gte = new Date(dateFrom);
      if (dateTo) query.fileDate.$lte = new Date(dateTo);
    }

    // 7. Sorting
    let sortOptions = { fileDate: -1 };
    if (sortAlphabetical === 'true' || sortAlphabetical === 'asc') {
      sortOptions = { title: 1 };
    } else if (sortAlphabetical === 'desc') {
      sortOptions = { title: -1 };
    }

    // 8. Pagination
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, documents] = await Promise.all([
      Document.countDocuments(query),
      Document.find(query)
        .populate('departmentId', 'name code')
        .populate('createdBy', 'name email')
        .populate('forwardedDepartments.departmentId', 'name code')
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: documents,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Document Details
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('departmentId', 'name code description')
      .populate('createdBy', 'name email')
      .populate('forwardedDepartments.departmentId', 'name code')
      .populate('forwardedDepartments.forwardedBy', 'name email');

    res.status(200).json({
      success: true,
      userPermission: req.userPermission,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Access Control & Target Audience
 * Admin / Super Admin
 */
export const updatePermissions = async (req, res, next) => {
  try {
    const { targetAudience, allowedUsers } = req.body;
    const document = req.document;

    const isSuperAdmin = req.user.role === 'super_admin';
    const isOriginAdmin =
      req.user.role === 'department_admin' &&
      req.user.departmentId?.toString() === document.departmentId.toString();

    if (!isSuperAdmin && !isOriginAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin or Originating Department Admin can update main permissions',
      });
    }

    if (targetAudience) document.targetAudience = targetAudience;
    await document.save();

    // If allowedUsers list is provided, bulk upsert into DocumentPermission
    if (allowedUsers && Array.isArray(allowedUsers)) {
      const bulkOps = allowedUsers.map((u) => ({
        updateOne: {
          filter: { documentId: document._id, userId: u.userId },
          update: {
            $set: {
              permissions: u.permissions || {
                canView: true,
                canRemark: true,
                canSuggestChange: true,
                canDownload: true,
              },
              departmentId: document.departmentId,
              grantedBy: req.user.id,
              grantedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (bulkOps.length > 0) {
        await DocumentPermission.bulkWrite(bulkOps);
      }
    }

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'UPDATE_PERMISSIONS',
      description: `Access control permissions updated by ${req.user.name || req.user.email}`,
      details: { targetAudience, updatedUsersCount: allowedUsers?.length || 0 },
    });

    res.status(200).json({
      success: true,
      message: 'Document permissions updated successfully',
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. List Permissions for a Document (Paginated, handles 500 - 2,000+ users easily)
 */
export const listDocumentPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const filter = { documentId: id };

    const [total, permissions] = await Promise.all([
      DocumentPermission.countDocuments(filter),
      DocumentPermission.find(filter)
        .populate('userId', 'name email role departmentId')
        .populate('grantedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: permissions,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Bulk Grant Document Permissions to Specific Users
 */
export const grantDocumentPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { allowedUsers } = req.body;

    if (!allowedUsers || !Array.isArray(allowedUsers) || allowedUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'allowedUsers array is required with at least one user',
      });
    }

    const document = req.document;

    const bulkOps = allowedUsers.map((u) => ({
      updateOne: {
        filter: { documentId: document._id, userId: u.userId },
        update: {
          $set: {
            permissions: u.permissions || {
              canView: true,
              canRemark: true,
              canSuggestChange: true,
              canDownload: true,
            },
            departmentId: document.departmentId,
            grantedBy: req.user.id,
            grantedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await DocumentPermission.bulkWrite(bulkOps);

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'UPDATE_PERMISSIONS',
      description: `Permissions granted to ${allowedUsers.length} user(s) by ${req.user.name || req.user.email}`,
      details: { grantedCount: allowedUsers.length },
    });

    res.status(200).json({
      success: true,
      message: `Permissions successfully granted to ${allowedUsers.length} user(s)`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Revoke Document Permission for a Specific User
 */
export const revokeDocumentPermission = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const document = req.document;

    const deleted = await DocumentPermission.findOneAndDelete({
      documentId: document._id,
      userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Permission record not found for this user',
      });
    }

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'UPDATE_PERMISSIONS',
      description: `Access permission revoked for user ${userId} by ${req.user.name || req.user.email}`,
      details: { revokedUserId: userId },
    });

    res.status(200).json({
      success: true,
      message: 'User permission revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Forward Document to Another Department
 */
export const forwardDocument = async (req, res, next) => {
  try {
    const { targetDepartmentId, targetAudience, allowedUsers } = req.body;
    const document = req.document;

    if (!targetDepartmentId) {
      return res.status(400).json({
        success: false,
        message: 'targetDepartmentId is required to forward document',
      });
    }

    const targetDept = await Department.findById(targetDepartmentId);
    if (!targetDept) {
      return res.status(404).json({
        success: false,
        message: 'Target department to forward to not found',
      });
    }

    const alreadyForwarded = document.forwardedDepartments.some(
      (f) => f.departmentId.toString() === targetDepartmentId.toString() && !f.isDeletedForDept
    );

    if (alreadyForwarded) {
      return res.status(409).json({
        success: false,
        message: `Document has already been forwarded to ${targetDept.name}`,
      });
    }

    document.forwardedDepartments.push({
      departmentId: targetDepartmentId,
      forwardedBy: req.user.id,
      forwardedAt: new Date(),
      targetAudience: targetAudience || 'all_employees',
      isDeletedForDept: false,
    });

    await document.save();

    // If allowedUsers passed for forwarded department, store into DocumentPermission
    if (allowedUsers && Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const permDocs = allowedUsers.map((u) => ({
        documentId: document._id,
        userId: u.userId,
        departmentId: targetDepartmentId,
        permissions: u.permissions || {
          canView: true,
          canRemark: true,
          canSuggestChange: true,
          canDownload: true,
        },
        grantedBy: req.user.id,
      }));
      await DocumentPermission.insertMany(permDocs, { ordered: false }).catch(() => {});
    }

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'FORWARD_TO_DEPARTMENT',
      description: `Document forwarded to '${targetDept.name}' by ${req.user.name || req.user.email}`,
      details: { targetDepartment: targetDept.name, targetDepartmentId },
    });

    res.status(200).json({
      success: true,
      message: `Document successfully forwarded to department: ${targetDept.name}`,
      data: document.forwardedDepartments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Update Forwarded Department Permissions
 * Managed by Recipient Department Admin or Super Admin
 */
export const updateForwardedPermissions = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const { targetAudience, allowedUsers } = req.body;
    const document = req.document;

    const isSuperAdmin = req.user.role === 'super_admin';
    const isTargetDeptAdmin =
      req.user.role === 'department_admin' &&
      req.user.departmentId?.toString() === departmentId.toString();

    if (!isSuperAdmin && !isTargetDeptAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the recipient Department Admin or Super Admin can manage permissions for this department',
      });
    }

    const forwardedDept = document.forwardedDepartments.find(
      (f) => f.departmentId.toString() === departmentId.toString()
    );

    if (!forwardedDept) {
      return res.status(404).json({
        success: false,
        message: 'This document is not currently forwarded to this department',
      });
    }

    if (targetAudience) forwardedDept.targetAudience = targetAudience;
    await document.save();

    // Update specific permissions in DocumentPermission collection
    if (allowedUsers && Array.isArray(allowedUsers)) {
      const bulkOps = allowedUsers.map((u) => ({
        updateOne: {
          filter: { documentId: document._id, userId: u.userId },
          update: {
            $set: {
              permissions: u.permissions || {
                canView: true,
                canRemark: true,
                canSuggestChange: true,
                canDownload: true,
              },
              departmentId,
              grantedBy: req.user.id,
              grantedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));
      if (bulkOps.length > 0) {
        await DocumentPermission.bulkWrite(bulkOps);
      }
    }

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'UPDATE_FORWARDED_PERMISSIONS',
      description: `Permissions for forwarded department updated by ${req.user.name || req.user.email}`,
      details: { departmentId, targetAudience },
    });

    res.status(200).json({
      success: true,
      message: 'Forwarded department permissions updated successfully',
      data: forwardedDept,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Add Remarks from Accessor
 */
export const addRemark = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Remark comment text is required',
      });
    }

    const document = req.document;
    const newRemark = {
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    document.remarks.push(newRemark);
    await document.save();

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'ADD_REMARK',
      description: `Remark added by ${newRemark.userName}`,
      details: { comment: newRemark.comment },
    });

    res.status(201).json({
      success: true,
      message: 'Remark added successfully',
      data: document.remarks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 11. Add Virtual Sticky Note (Colorful)
 */
export const addSticky = async (req, res, next) => {
  try {
    const { note, color } = req.body;
    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Sticky note text is required',
      });
    }

    const document = req.document;
    const newSticky = {
      color: color || 'yellow',
      note: note.trim(),
      createdBy: req.user.id,
      authorName: req.user.name || req.user.email,
      createdAt: new Date(),
    };

    document.stickies.push(newSticky);
    await document.save();

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'ADD_STICKY',
      description: `Sticky note (${newSticky.color}) attached by ${newSticky.authorName}`,
      details: { color: newSticky.color, note: newSticky.note },
    });

    res.status(201).json({
      success: true,
      message: 'Virtual sticky note added successfully',
      data: document.stickies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 12. Add Official Document Noting
 */
export const addNoting = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Noting content text is required',
      });
    }

    const document = req.document;
    const newNoting = {
      text: text.trim(),
      author: req.user.id,
      authorName: req.user.name || req.user.email,
      isApproved: false,
      createdAt: new Date(),
    };

    document.notings.push(newNoting);
    await document.save();

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'ADD_NOTING',
      description: `Official noting drafted by ${newNoting.authorName}`,
      details: { text: newNoting.text },
    });

    res.status(201).json({
      success: true,
      message: 'Document noting added. Awaiting authorized signature/approval.',
      data: document.notings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 13. Approve Official Document Noting
 * Admin / Super Admin
 */
export const approveNoting = async (req, res, next) => {
  try {
    const { notingId } = req.params;
    const document = req.document;

    if (req.user.role !== 'super_admin' && req.user.role !== 'department_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Department Admins or Super Admins can sign and approve document notings',
      });
    }

    const noting = document.notings.id(notingId);
    if (!noting) {
      return res.status(404).json({
        success: false,
        message: 'Document noting not found',
      });
    }

    noting.isApproved = true;
    noting.approvedBy = req.user.id;
    noting.approvedByName = req.user.name || req.user.email;
    noting.approvedAt = new Date();

    await document.save();

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'APPROVE_NOTING',
      description: `Official noting approved and signed by ${noting.approvedByName}`,
      details: { notingId },
    });

    res.status(200).json({
      success: true,
      message: 'Document noting approved and signed successfully',
      data: noting,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 14. Withdraw File
 */
export const withdrawFile = async (req, res, next) => {
  try {
    const document = req.document;
    const isCreator = document.createdBy.toString() === req.user.id.toString();
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the document creator or Super Admin can withdraw this file',
      });
    }

    document.status = 'withdrawn';
    await document.save();

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'WITHDRAW_FILE',
      description: `Document withdrawn by ${req.user.name || req.user.email}`,
    });

    res.status(200).json({
      success: true,
      message: 'Document successfully marked as withdrawn',
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 15. Employee Self-Delete (Remove Access from Personal View)
 */
export const employeeSelfDelete = async (req, res, next) => {
  try {
    const document = req.document;
    const userId = req.user.id;

    const alreadyHidden = document.hiddenForUsers.some(
      (h) => h.userId.toString() === userId.toString()
    );

    if (!alreadyHidden) {
      document.hiddenForUsers.push({
        userId,
        removedAt: new Date(),
      });
      await document.save();
    }

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'EMPLOYEE_REMOVED_ACCESS',
      description: `Employee ${req.user.name || req.user.email} removed this document from their personal access`,
    });

    res.status(200).json({
      success: true,
      message: 'Document removed from your personal access. Other employees and department access remain unaffected.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 16. Department Admin Delete (Delete from Department Only)
 */
export const departmentDelete = async (req, res, next) => {
  try {
    if (req.user.role !== 'department_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Department Admins or Super Admins can remove a file from department access',
      });
    }

    const document = req.document;
    const userDeptId = req.user.departmentId?.toString();

    if (document.departmentId.toString() === userDeptId) {
      document.isDeletedForOriginDept = true;
      document.originDeptDeletedAt = new Date();
      document.originDeptDeletedBy = req.user.id;
    } else {
      const forwardedDept = document.forwardedDepartments.find(
        (f) => f.departmentId.toString() === userDeptId
      );

      if (forwardedDept) {
        forwardedDept.isDeletedForDept = true;
        forwardedDept.deletedAt = new Date();
        forwardedDept.deletedBy = req.user.id;
      } else if (req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only delete files for your assigned department',
        });
      }
    }

    await document.save();

    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'DEPT_ADMIN_DELETED_FILE',
      description: `File access deleted for department by ${req.user.name || req.user.email}. Super Admin retains global access.`,
    });

    res.status(200).json({
      success: true,
      message: 'File removed from department view. Super Admin retains global access and full audit logs.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 17. Permanent Hard Delete (Super Admin strictly)
 */
export const permanentDelete = async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Strictly Super Admin only: Permanent file deletion requires super_admin role',
      });
    }

    const { id } = req.params;
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Try deleting physical file from disk
    if (document.filePath && fs.existsSync(document.filePath)) {
      try {
        fs.unlinkSync(document.filePath);
      } catch (err) {
        console.warn('Physical file deletion warning:', err.message);
      }
    }

    // Clean up all permissions in DocumentPermission collection
    await DocumentPermission.deleteMany({ documentId: id });

    // Log the permanent deletion action before removing the document
    await recordDocumentLog({
      documentId: document._id,
      user: req.user,
      action: 'PERMANENT_DELETE',
      description: `Document '${document.title}' was permanently deleted and purged by Super Admin ${req.user.name || req.user.email}`,
      details: { title: document.title, originalName: document.originalName },
    });

    await Document.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Document and all associated permissions permanently deleted from database and storage',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 18. Get Document Activity Logs
 */
export const getDocumentLogs = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, logs] = await Promise.all([
      DocumentLog.countDocuments({ documentId: req.params.id }),
      DocumentLog.find({ documentId: req.params.id })
        .populate('performedBy', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: logs,
      })
    );
  } catch (error) {
    next(error);
  }
};
