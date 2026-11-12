import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, verifyToken } from '../src/utils/token.util.js';
import { generateRandomToken, hashToken } from '../src/utils/crypto.util.js';
import { User } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { EmailRequest } from '../src/models/email.request.model.js';
import { Document } from '../src/models/document.model.js';
import { DocumentReplica } from '../src/models/document.replica.model.js';
import { DocumentLog } from '../src/models/document.log.model.js';
import { DocumentPermission } from '../src/models/document.permission.model.js';
import { getPaginationParams, formatPaginatedResponse } from '../src/utils/pagination.util.js';

describe('Project Tests', () => {
  it('should generate and verify JWT token', () => {
    const payload = { id: '650c1f1e1f1e1f1e1f1e1f1e', email: 'admin@example.com', role: 'super_admin' };
    const token = generateToken(payload);
    assert.ok(typeof token === 'string');

    const decoded = verifyToken(token);
    assert.strictEqual(decoded.email, payload.email);
    assert.strictEqual(decoded.role, payload.role);
  });

  it('should generate crypto tokens and hash correctly', () => {
    const token = generateRandomToken(32);
    assert.strictEqual(token.length, 64);

    const hashed = hashToken(token);
    assert.strictEqual(hashed.length, 64);
    assert.notStrictEqual(token, hashed);
  });

  it('should validate User model schema definition with new roles and reset fields', () => {
    const paths = Object.keys(User.schema.paths);
    assert.ok(paths.includes('role'));
    assert.ok(paths.includes('departmentId'));
    assert.ok(paths.includes('passwordResetToken'));
    assert.ok(paths.includes('passwordResetExpires'));
  });

  it('should validate Department model schema definition', () => {
    const paths = Object.keys(Department.schema.paths);
    assert.ok(paths.includes('name'));
    assert.ok(paths.includes('code'));
    assert.ok(paths.includes('createdBy'));
  });

  it('should validate EmailRequest model schema definition', () => {
    const paths = Object.keys(EmailRequest.schema.paths);
    assert.ok(paths.includes('userId'));
    assert.ok(paths.includes('currentEmail'));
    assert.ok(paths.includes('requestedEmail'));
    assert.ok(paths.includes('status'));
  });

  it('should validate Document model schema definition', () => {
    const paths = Object.keys(Document.schema.paths);
    assert.ok(paths.includes('title'));
    assert.ok(paths.includes('fileDate'));
    assert.ok(paths.includes('subject'));
    assert.ok(paths.includes('shelf'));
    assert.ok(paths.includes('highlights'));
    assert.ok(paths.includes('targetAudience'));
    assert.ok(paths.includes('isDeletedForOriginDept'));
  });

  it('should validate DocumentReplica and DocumentLog model schema definitions', () => {
    const replicaPaths = Object.keys(DocumentReplica.schema.paths);
    assert.ok(replicaPaths.includes('parentDocumentId'));
    assert.ok(replicaPaths.includes('proposedChanges'));
    assert.ok(replicaPaths.includes('status'));

    const logPaths = Object.keys(DocumentLog.schema.paths);
    assert.ok(logPaths.includes('documentId'));
    assert.ok(logPaths.includes('action'));
    assert.ok(logPaths.includes('performedBy'));
  });

  it('should validate DocumentPermission model schema definition', () => {
    const permPaths = Object.keys(DocumentPermission.schema.paths);
    assert.ok(permPaths.includes('documentId'));
    assert.ok(permPaths.includes('userId'));
    assert.ok(permPaths.includes('permissions.canView'));
    assert.ok(permPaths.includes('grantedBy'));
  });

  it('should parse pagination params and format paginated responses correctly', () => {
    const params = getPaginationParams({ page: '2', pageSize: '15' });
    assert.strictEqual(params.page, 2);
    assert.strictEqual(params.pageSize, 15);
    assert.strictEqual(params.skip, 15);

    const formatted = formatPaginatedResponse({
      total: 45,
      page: params.page,
      pageSize: params.pageSize,
      data: [{ id: 1 }, { id: 2 }],
    });

    assert.strictEqual(formatted.success, true);
    assert.strictEqual(formatted.total, 45);
    assert.strictEqual(formatted.page, 2);
    assert.strictEqual(formatted.pageSize, 15);
    assert.strictEqual(formatted.totalPages, 3);
    assert.strictEqual(formatted.data.length, 2);
  });
});
