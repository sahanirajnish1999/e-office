import { User } from '../models/user.model.js';
import { Department } from '../models/department.model.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.util.js';

export const createEmployee = async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    // Determine target department
    let targetDeptId = req.user.departmentId;

    // Super admin can specify a departmentId explicitly
    if (req.user.role === 'super_admin') {
      if (!departmentId) {
        return res.status(400).json({
          success: false,
          message: 'Super Admin must specify a departmentId to assign the employee',
        });
      }
      targetDeptId = departmentId;
    } else {
      // Department admin must have a department assigned
      if (!targetDeptId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to any department and cannot create employees',
        });
      }
    }

    const dept = await Department.findById(targetDeptId);
    if (!dept) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    const employee = await User.create({
      name,
      email,
      password,
      role: 'employee',
      departmentId: targetDeptId,
    });

    res.status(201).json({
      success: true,
      message: `Employee created successfully for department: ${dept.name}`,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

export const listEmployees = async (req, res, next) => {
  try {
    const filter = { role: 'employee' };

    // If department admin, scope search strictly to their department
    if (req.user.role === 'department_admin') {
      filter.departmentId = req.user.departmentId;
    } else if (req.query.departmentId) {
      // Super admin can filter by department if provided in query
      filter.departmentId = req.query.departmentId;
    }

    const { page, pageSize, skip } = getPaginationParams(req.query);

    const [total, employees] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
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
        data: employees,
      })
    );
  } catch (error) {
    next(error);
  }
};
