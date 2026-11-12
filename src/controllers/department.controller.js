import { Department } from '../models/department.model.js';
import { User } from '../models/user.model.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Department name and unique code are required',
      });
    }

    const existing = await Department.findOne({
      $or: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Department with this name or code already exists',
      });
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description || '',
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

export const listDepartments = async (req, res, next) => {
  try {
    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, departments] = await Promise.all([
      Department.countDocuments(),
      Department.find()
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        total,
        page,
        pageSize,
        data: departments,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id).populate('createdBy', 'name email');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Also get the admin and employees of this department
    const members = await User.find({ departmentId: id }).select('name email role');

    res.status(200).json({
      success: true,
      data: {
        department,
        members,
      },
    });
  } catch (error) {
    next(error);
  }
};
