import { EmailRequest } from '../models/email.request.model.js';
import { User } from '../models/user.model.js';
import { sendEmailChangeNotification } from '../utils/mail.util.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

export const requestEmailChange = async (req, res, next) => {
  try {
    const { requestedEmail, reason } = req.body;

    if (!requestedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Requested new email is required',
      });
    }

    const normalizedEmail = requestedEmail.trim().toLowerCase();

    // Check if user is trying to change to their current email
    const currentUser = await User.findById(req.user.id);
    if (currentUser.email === normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Requested email is already your current email',
      });
    }

    // Check if new email is already taken by any user
    const emailTaken = await User.findOne({ email: normalizedEmail });
    if (emailTaken) {
      return res.status(409).json({
        success: false,
        message: 'This email address is already in use by another user',
      });
    }

    // Check if there is already an existing pending request for this user
    const pendingRequest = await EmailRequest.findOne({
      userId: req.user.id,
      status: 'pending',
    });

    if (pendingRequest) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active pending email change request awaiting Super Admin approval',
        data: pendingRequest,
      });
    }

    const request = await EmailRequest.create({
      userId: req.user.id,
      currentEmail: currentUser.email,
      requestedEmail: normalizedEmail,
      reason: reason || '',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Email change request submitted successfully. Awaiting Super Admin review and approval.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyRequests = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, requests] = await Promise.all([
      EmailRequest.countDocuments({ userId: req.user.id }),
      EmailRequest.find({ userId: req.user.id })
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
        data: requests,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const listAllRequests = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, requests] = await Promise.all([
      EmailRequest.countDocuments(filter),
      EmailRequest.find(filter)
        .populate('userId', 'name email role departmentId')
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
        data: requests,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const reviewEmailRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"',
      });
    }

    const request = await EmailRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Email change request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}`,
      });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'The user who made this request no longer exists',
      });
    }

    if (status === 'approved') {
      // Re-verify that the requested email is still available
      const emailTaken = await User.findOne({ email: request.requestedEmail });
      if (emailTaken && emailTaken._id.toString() !== user._id.toString()) {
        return res.status(409).json({
          success: false,
          message: 'The requested email has since been taken by another user. Cannot approve.',
        });
      }

      const oldEmail = user.email;
      user.email = request.requestedEmail;
      await user.save();

      request.status = 'approved';
      request.reviewedBy = req.user.id;
      request.reviewedAt = new Date();
      request.reviewNotes = reviewNotes || 'Approved by Super Admin';
      await request.save();

      // Send notifications to both old and new email addresses
      try {
        await sendEmailChangeNotification(oldEmail, 'approved', request.requestedEmail);
        await sendEmailChangeNotification(request.requestedEmail, 'approved', request.requestedEmail);
      } catch (err) {
        console.error('Email change notification failed:', err.message);
      }

      return res.status(200).json({
        success: true,
        message: `Email change request approved. User's email updated from ${oldEmail} to ${request.requestedEmail}.`,
        data: request,
      });
    } else {
      request.status = 'rejected';
      request.reviewedBy = req.user.id;
      request.reviewedAt = new Date();
      request.reviewNotes = reviewNotes || 'Rejected by Super Admin';
      await request.save();

      try {
        await sendEmailChangeNotification(user.email, 'rejected', request.requestedEmail, reviewNotes);
      } catch (err) {
        console.error('Email change notification failed:', err.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Email change request rejected',
        data: request,
      });
    }
  } catch (error) {
    next(error);
  }
};
