import { User } from '../models/user.model.js';
import { Department } from '../models/department.model.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

export const createDepartmentAdmin = async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;

    if (!name || !email || !password || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and departmentId are required',
      });
    }

    // Verify department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if email already registered
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'department_admin',
      departmentId,
    });

    res.status(201).json({
      success: true,
      message: `Department Admin created successfully for ${department.name}`,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('departmentId', 'name code description');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, users] = await Promise.all([
      User.countDocuments(),
      User.find()
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: users,
      })
    );
  } catch (error) {
    next(error);
  }
};
