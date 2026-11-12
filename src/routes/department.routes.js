import { Router } from 'express';
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
} from '../controllers/department.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';

const router = Router();

// All department endpoints require authentication
router.use(authenticateToken);

// Super admin creates departments
router.post('/', authorizeRoles('super_admin'), createDepartment);

// All authenticated roles can list or view departments
router.get('/', listDepartments);
router.get('/:id', getDepartmentById);

export default router;
