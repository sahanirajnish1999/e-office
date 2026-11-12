import { Router } from 'express';
import {
  requestEmailChange,
  getMyRequests,
  listAllRequests,
  reviewEmailRequest,
} from '../controllers/email.request.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticateToken);

// Department Admins and Employees (or any user) can submit & view their own requests
router.post('/', requestEmailChange);
router.get('/my', getMyRequests);

// Super admin reviews and approves/rejects requests
router.get('/', authorizeRoles('super_admin'), listAllRequests);
router.patch('/:id/review', authorizeRoles('super_admin'), reviewEmailRequest);

export default router;
