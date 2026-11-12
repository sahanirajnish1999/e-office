import dotenv from 'dotenv';

dotenv.config();

export const appConfig = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/express_node_db',
  jwtSecret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
