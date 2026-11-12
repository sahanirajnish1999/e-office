# Enterprise Management & Document Collaboration REST API

A modular, enterprise-grade Express.js application featuring Role-Based Access Control (RBAC), Department Hierarchies, Email Change Approval Workflows, Password Recovery with Email Verification, and an advanced **Document Collaboration & Governance System**.

---

## Key Features

1. **Hierarchy & Roles (RBAC)**:
   - **Super Admin**: Global visibility, department & admin creation, email request approval, permanent document deletion.
   - **Department Admin**: Scoped to their department; manages employees and files, forwards files to other departments, approves replicas and notings.
   - **Employee**: Assigned to a department; views permitted files, adds remarks, attaches colorful stickies, drafts notings, and creates file replicas to suggest changes.

2. **Document Management & Governance**:
   - **File Upload & Shelf Storage**: Physical file stored securely via Multer with custom title, issue date, subject/purpose, shelf/cabinet identifier, and key highlights.
   - **Access Control & Permissions**: Target audience controls (`all_employees`, `department_only`, `specific_employees`) with granular permissions (`canView`, `canRemark`, `canSuggestChange`, `canDownload`).
   - **Multi-Department Forwarding**: Files can be forwarded to another department. The recipient Department Admin controls permissions for their own employees.
   - **Replica Creation (Fork & Propose Changes)**: Employees propose modifications or revised files via replicas, which are reviewed and approved/rejected by Admins.
   - **Virtual Sticky Notes**: Colorful digital stickies (`yellow`, `blue`, `green`, `pink`, `orange`, `purple`).
   - **Official Document Notings**: Formal notes with sign-off and approval by authorized Department Admins or Super Admins.
   - **Multi-Tier Deletion Architecture**:
     - **Employee Self-Delete**: Removes the file from the employee's personal view only. Other employees and Admins are unaffected.
     - **Department-Level Delete**: Dept Admin removes file from their department view. Super Admin retains global access.
     - **Permanent Delete**: Strictly Super Admin only; purges physical file and database entry.
   - **Complete Activity Audit Log**: Every single operation (upload, permission update, forwarding, remark, sticky, noting, replica, withdrawal, deletion) is permanently recorded with user name, role, action, and timestamp.

---

## Project Structure

Following the **dot-separated lowercase naming convention**:

```
.
├── .env
├── .env.example
├── .gitignore
├── package.json
├── postman_collection.json          # Ready-to-import Postman collection
├── README.md
├── uploads/                         # Stored uploaded files
└── src/
    ├── app.js                       # Express app configuration & middleware
    ├── server.js                    # Server startup & DB connection
    ├── config/
    │   ├── app.config.js            # Environment settings
    │   └── db.config.js             # MongoDB connection logic
    ├── controllers/
    │   ├── auth.controller.js       # Register, login, forgot/reset password
    │   ├── department.controller.js # Department management
    │   ├── document.controller.js   # Upload, forward, permissions, stickies, notings, deletions
    │   ├── document.replica.controller.js # File replica creation & review
    │   ├── email.request.controller.js # Email change requests & approval
    │   ├── employee.controller.js   # Department-scoped employee management
    │   ├── file.controller.js       # General file uploads
    │   ├── mail.controller.js       # General mail dispatcher
    │   └── user.controller.js       # Profile & department admin creation
    ├── middlewares/
    │   ├── auth.middleware.js       # JWT Bearer verification
    │   ├── document.access.middleware.js # Multi-department & permission validator
    │   ├── error.middleware.js      # 404 & centralized error handlers
    │   ├── role.middleware.js       # authorizeRoles('super_admin', ...)
    │   └── upload.middleware.js     # Multer file storage configuration
    ├── models/
    │   ├── department.model.js      # Departments schema
    │   ├── document.log.model.js    # Immutable activity audit log
    │   ├── document.model.js        # Main document governance schema
    │   ├── document.permission.model.js # Pattern B: Scalable permissions collection (500 - 2,000+ users)
    │   ├── document.replica.model.js# Replicas & suggested changes schema
    │   ├── email.request.model.js   # Email change requests schema
    │   ├── file.model.js            # Basic uploaded files schema
    │   └── user.model.js            # Users with roles & reset token schema
    ├── routes/
    │   ├── api.routes.js            # Master API router
    │   ├── auth.routes.js           # /api/auth routes
    │   ├── department.routes.js     # /api/departments routes
    │   ├── document.routes.js       # /api/documents routes
    │   ├── email.request.routes.js  # /api/email-requests routes
    │   ├── employee.routes.js       # /api/employees routes
    │   ├── file.routes.js           # /api/files routes
    │   ├── mail.routes.js           # /api/mail routes
    │   └── user.routes.js           # /api/users routes
    └── utils/
        ├── crypto.util.js           # Secure random token generator & hasher
        ├── document.logger.js       # Audit log recorder helper
        ├── mail.util.js             # Nodemailer transporter & templates
        └── token.util.js            # JWT signing & verification
```

---

## Document API Endpoints Summary

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/documents` | Super Admin / Dept Admin | Upload file & create document with shelf, subject, highlights, audience |
| `GET` | `/api/documents` | Authenticated | Search & list files (supports `subject`, `shelf`, `departmentId`, `sortAlphabetical`, `dateFrom`, `dateTo`) |
| `GET` | `/api/documents/:id` | Permitted Accessors | View document details |
| `PATCH` | `/api/documents/:id/permissions` | Dept Admin / Super Admin | Update targetAudience & access control |
| `GET` | `/api/documents/:id/permissions` | Dept Admin / Super Admin | Paginated list of users granted access (`?page=1&pageSize=10`) |
| `POST` | `/api/documents/:id/permissions/grant` | Dept Admin / Super Admin | Bulk grant access to specific users |
| `DELETE` | `/api/documents/:id/permissions/:userId` | Dept Admin / Super Admin | Revoke access for a specific user |
| `POST` | `/api/documents/:id/forward` | Dept Admin / Super Admin | Forward file to another department |
| `PATCH` | `/api/documents/:id/forwarded-permissions/:deptId` | Recipient Dept Admin | Set employee permissions in forwarded department |
| `POST` | `/api/documents/:id/remarks` | Permitted Accessors | Add remark/comment |
| `POST` | `/api/documents/:id/stickies` | Permitted Accessors | Add colorful virtual sticky note |
| `POST` | `/api/documents/:id/notings` | Permitted Accessors | Draft official document noting |
| `PATCH` | `/api/documents/:id/notings/:notingId/approve` | Dept Admin / Super Admin | Formally sign and approve document noting |
| `POST` | `/api/documents/:id/replicas` | Permitted Employees | Create replica of file to propose changes |
| `GET` | `/api/documents/:id/replicas` | Permitted Accessors | View all replicas for a document |
| `PATCH` | `/api/documents/replicas/:replicaId/review` | Dept Admin / Super Admin | Approve/Reject replica suggestion (optional merge) |
| `PATCH` | `/api/documents/:id/withdraw` | Creator / Super Admin | Withdraw/deactivate document |
| `DELETE` | `/api/documents/:id/my-access` | Employee | Remove file from personal view only |
| `DELETE` | `/api/documents/:id/department` | Dept Admin | Remove file from department view |
| `DELETE` | `/api/documents/:id/permanent` | **Super Admin Strictly** | Permanently purge file and database entry |
| `GET` | `/api/documents/:id/logs` | Permitted Accessors | View complete activity audit trail |

---

## Pagination & Query Parameters

All list endpoints support pagination with `page` and `pageSize` (or `limit`):

```http
GET /api/documents?page=1&pageSize=10
```

### Standardized Paginated Response Format:
```json
{
  "success": true,
  "total": 45,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5,
  "data": [ ... ]
}
```

Paginated Endpoints:
- `GET /api/documents`
- `GET /api/documents/:id/logs`
- `GET /api/documents/:id/replicas`
- `GET /api/departments`
- `GET /api/employees`
- `GET /api/users`
- `GET /api/email-requests`
- `GET /api/email-requests/my`
- `GET /api/files`

---

## Available Scripts

- **`npm run dev`**: Starts server with `nodemon` auto-reload.
- **`npm start`**: Starts server in production mode.
- **`npm test`**: Runs unit test suite (`node --test`).
