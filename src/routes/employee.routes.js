import { Router } from 'express';
import { createEmployee, listEmployees } from '../controllers/employee.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticateToken);

// Super admin and Department Admin can create and view employees
router.post('/', authorizeRoles('super_admin', 'department_admin'), createEmployee);
router.get('/', authorizeRoles('super_admin', 'department_admin'), listEmployees);

export default router;
