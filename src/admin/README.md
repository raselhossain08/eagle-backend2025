# RBAC (Role-Based Access Control) System

A comprehensive Role-Based Access Control system for managing user permissions across different organizational roles.

## 📋 Overview

This RBAC system implements fine-grained permission control with the following roles:

### 🔐 User Roles

1. **Super Admin** 🔴
   - Full access including security settings and destructive actions
   - **No permission checks required** - bypasses all restrictions
   - Can manage all aspects of the system

2. **Finance Admin** 💰
   - Billing, invoices, refunds, payouts, taxes, financial reports
   - Full financial management capabilities
   - Read access to user data for billing purposes

3. **Growth/Marketing** 📈
   - Discounts, campaigns, announcements, analytics read access
   - Marketing campaign management
   - Customer analytics and reporting

4. **Support** 🎧
   - Subscriber lookup, plan changes (non-financial)
   - Resend receipts, initiate cancellations (with policy)
   - User impersonation for support purposes
   - Support ticket management

5. **Read-Only** 👀
   - All reports and dashboards, no write permissions
   - View-only access across all modules
   - Perfect for stakeholders and observers

## 📁 Folder Structure

```
src/api/
├── controllers/          # Business logic controllers
│   ├── role.controller.js
│   ├── permission.controller.js
│   ├── userRole.controller.js
│   └── audit.controller.js
├── routes/              # API routes
│   ├── role.routes.js
│   ├── permission.routes.js
│   ├── userRole.routes.js
│   ├── audit.routes.js
│   └── index.js
├── models/              # Database models
│   ├── role.model.js
│   ├── permission.model.js
│   ├── userRole.model.js
│   └── auditLog.model.js
├── middlewares/         # Middleware functions
│   └── rbac.middleware.js
├── seeders/            # Database seeders
│   └── rbac.seeder.js
└── utils/              # Utility functions
    └── rbac.utils.js
```

## 🚀 Getting Started

### 1. Installation

The RBAC system is ready to use. Ensure you have the required dependencies in your main project.

### 2. Database Setup

Run the seeder to initialize roles and permissions:

```bash
# Seed all roles and permissions
node src/api/seeders/rbac.seeder.js seed

# Assign super admin role to a user
node src/api/seeders/rbac.seeder.js assign-super-admin <userId>

# Reset RBAC system (caution: removes all data)
node src/api/seeders/rbac.seeder.js reset
```

### 3. Integration

Add the RBAC routes to your main app:

```javascript
const express = require('express');
const rbacRoutes = require('./src/api/routes');

const app = express();

// Mount RBAC routes
app.use('/api', rbacRoutes);
```

## 🛡️ Permission System

### Permission Categories

- `user_management` - User and role management
- `billing_finance` - Financial operations
- `marketing_growth` - Marketing and growth activities
- `support_operations` - Customer support functions
- `subscription_management` - Subscription handling
- `analytics_reports` - Analytics and reporting
- `security_settings` - Security configurations
- `system_admin` - System administration

### Permission Actions

- `create` - Create new resources
- `read` - View resources
- `update` - Modify resources
- `delete` - Remove resources
- `execute` - Execute special operations
- `approve` - Approve operations
- `cancel` - Cancel operations

## 🔧 Usage Examples

### Middleware Usage

```javascript
const RBACMiddleware = require('./src/api/middlewares/rbac.middleware');

// Check specific permission
router.get('/users', 
  authMiddleware, // Your authentication middleware
  RBACMiddleware.checkPermission('users', 'read'),
  getUsersController
);

// Check role
router.post('/admin-action',
  authMiddleware,
  RBACMiddleware.checkRole(['super_admin', 'finance_admin']),
  adminActionController
);

// Inject user permissions (optional)
router.use(RBACMiddleware.injectUserPermissions);
```

### Controller Usage

```javascript
const RBACUtils = require('./src/api/utils/rbac.utils');

// Get user's effective permissions
const userPermissions = await RBACUtils.getUserEffectivePermissions(userId);

// Check multiple permissions
const permissionCheck = await RBACUtils.checkMultiplePermissions(userId, [
  { resource: 'billing', action: 'read' },
  { resource: 'users', action: 'update' }
]);

// Audit user permissions
const auditReport = await RBACUtils.auditUserPermissions(userId);
```

## 📊 API Endpoints

### Roles Management

```http
GET    /api/roles                    # Get all roles
GET    /api/roles/:roleId            # Get specific role
POST   /api/roles                    # Create new role
PUT    /api/roles/:roleId            # Update role
DELETE /api/roles/:roleId            # Delete role
POST   /api/roles/assign             # Assign role to user
DELETE /api/roles/user-role/:id      # Remove role from user
```

### Permissions Management

```http
GET    /api/permissions              # Get all permissions
GET    /api/permissions/:id          # Get specific permission
POST   /api/permissions              # Create permission
PUT    /api/permissions/:id          # Update permission
DELETE /api/permissions/:id          # Delete permission
POST   /api/permissions/bulk         # Bulk create permissions
GET    /api/permissions/category/:cat # Get by category
```

### User Roles

```http
GET    /api/user-roles               # Get all user role assignments
GET    /api/user-roles/user/:userId  # Get user's roles & permissions
GET    /api/user-roles/check-permission/:userId # Check user permission
GET    /api/user-roles/role/:roleId/users # Get users by role
PUT    /api/user-roles/:userRoleId   # Update user role assignment
POST   /api/user-roles/bulk-assign   # Bulk assign roles
GET    /api/user-roles/statistics    # Role statistics
```

### Audit Logs

```http
GET    /api/audit                    # Get audit logs
GET    /api/audit/statistics         # Audit statistics
GET    /api/audit/user/:userId       # User activity logs
GET    /api/audit/security-events    # Security events
```

## 🔐 Security Features

### Audit Logging
- All permission checks are logged
- Failed access attempts are recorded
- User actions are tracked
- Automatic log rotation (2-year retention)

### Super Admin Protection
- Super admin role cannot be deleted
- Only super admins can modify super admin roles
- Super admin bypasses all permission checks

### Permission Validation
- Real-time permission checking
- Role expiration handling
- Inactive role/permission filtering
- IP address and user agent tracking

## 📈 Monitoring & Analytics

### Role Statistics
- User count per role
- Recent role assignments
- Permission usage analytics
- Role hierarchy visualization

### Security Monitoring
- Failed permission checks
- Access denied events
- Role assignment changes
- Security violations

## 🔄 Migration & Maintenance

### Database Migrations
The seeder handles initial setup, but for production migrations:

1. Always backup the database
2. Test permission changes in staging
3. Use the audit logs to track changes
4. Monitor for permission conflicts

### Role Updates
When updating role permissions:

1. Use the permission matrix to visualize changes
2. Check for conflicts using `RBACUtils.getPermissionConflicts()`
3. Notify affected users of permission changes
4. Update documentation accordingly

## 🚨 Important Notes

### Super Admin Behavior
- **Super Admin role bypasses ALL permission checks**
- This is by design for emergency access and system management
- Use super admin role sparingly and only for trusted administrators

### Permission Inheritance
- Users can have multiple roles
- Permissions are cumulative across all active roles
- Role expiration is automatically handled

### Error Handling
- All permission failures return 403 Forbidden
- Detailed error messages in development mode
- Security events are logged for failed attempts

## 🔧 Configuration

### Environment Variables
```env
NODE_ENV=development|production  # Controls error message verbosity
```

### Default Permissions
All permissions and roles are defined in the seeder. Modify `src/api/seeders/rbac.seeder.js` to customize the permission structure for your needs.

---

## 🤝 Contributing

When adding new features:

1. Define permissions in the seeder
2. Add middleware checks to routes
3. Update role assignments as needed
4. Add audit logging for new actions
5. Update this documentation

## 📝 License

This RBAC system is part of the Eagle Backend project.