import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import departmentRoutes from './department.routes.js';
import employeeRoutes from './employee.routes.js';
import emailRequestRoutes from './email.request.routes.js';
import documentRoutes from './document.routes.js';
import fileRoutes from './file.routes.js';
import mailRoutes from './mail.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/employees', employeeRoutes);
router.use('/email-requests', emailRequestRoutes);
router.use('/documents', documentRoutes);
router.use('/files', fileRoutes);
router.use('/mail', mailRoutes);

export default router;
