import { sendMail } from '../utils/mail.util.js';

export const sendEmail = async (req, res, next) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        message: 'Recipient (to), subject, and content (text or html) are required',
      });
    }

    const result = await sendMail({ to, subject, text, html });

    res.status(200).json({
      success: true,
      message: 'Email processed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
