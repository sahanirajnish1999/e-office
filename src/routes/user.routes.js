import { Router } from 'express';
import {
  getProfile,
  listUsers,
  createDepartmentAdmin,
} from '../controllers/user.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticateToken);

// Super admin creates department admins
router.post('/department-admins', authorizeRoles('super_admin'), createDepartmentAdmin);

// Profile and user queries
router.get('/profile', getProfile);
router.get('/', authorizeRoles('super_admin'), listUsers);

export default router;
