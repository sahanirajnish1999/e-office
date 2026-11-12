import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app.config.js';

export const generateToken = (payload) => {
  return jwt.sign(payload, appConfig.jwtSecret, {
    expiresIn: appConfig.jwtExpiresIn,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, appConfig.jwtSecret);
};
