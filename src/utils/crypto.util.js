import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure random token string (hex)
 */
export const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Hash a plain token using SHA-256 for secure database storage
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
