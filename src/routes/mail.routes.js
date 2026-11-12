import { Router } from 'express';
import { sendEmail } from '../controllers/mail.controller.js';

const router = Router();

router.post('/send', sendEmail);

export default router;
