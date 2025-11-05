# Eagle Backend Admin API Endpoints

## Overview
Complete list of admin endpoints with authentication requirements, permissions, and descriptions.

## Base URLs
- Admin Authentication: `/api/admin/auth/`
- RBAC System: `/api/rbac/`

---

## 🔐 Authentication Endpoints (`/api/admin/auth/`)

### 1. `POST /api/admin/auth/login`
**Purpose**: Admin login with enhanced security  
**Body**:
```json
{
  "email": "admin@example.com",
  "password": "password123",
  "twoFactorCode": "123456" // Optional, required if 2FA enabled
}
```
**Response**: JWT token, user data, 2FA status

### 2. `POST /api/admin/auth/login-2fa`
**Purpose**: Complete login with 2FA code  
**Body**:
```json
{
  "email": "admin@example.com",
  "token": "123456"
}
```

### 3. `GET /api/admin/auth/profile`
**Purpose**: Get authenticated admin profile  
**Headers**: `Authorization: Bearer <token>`

### 4. `POST /api/admin/auth/setup-2fa`
**Purpose**: Initialize 2FA setup  
**Headers**: `Authorization: Bearer <token>`  
**Response**: QR code, secret key

### 5. `POST /api/admin/auth/confirm-2fa`
**Purpose**: Confirm and activate 2FA  
**Body**:
```json
{
  "token": "123456"
}
```

### 6. `POST /api/admin/auth/disable-2fa`
**Purpose**: Disable 2FA authentication  
**Body**:
```json
{
  "password": "currentPassword",
  "token": "123456"
}
```

### 7. `POST /api/admin/auth/change-password`
**Purpose**: Change admin password  
**Body**:
```json
{
  "currentPassword": "oldPass",
  "newPassword": "newPass"
}
```

### 8. `POST /api/admin/auth/forgot-password`
**Purpose**: Request password reset  
**Body**:
```json
{
  "email": "admin@example.com"
}
```

### 9. `POST /api/admin/auth/reset-password/:token`
**Purpose**: Reset password using token  
**Body**:
```json
{
  "password": "newPassword"
}
```

### 10. `GET /api/admin/auth/validate-token`
**Purpose**: Validate JWT token  
**Headers**: `Authorization: Bearer <token>`

### 11. `POST /api/admin/auth/logout`
**Purpose**: Admin logout (clear cookies)

---

## 👥 Role Management (`/api/rbac/roles/`)
**Authentication**: Required (Admin JWT)  
**Permission Required**: `user_management:read/create/update/delete`

### 12. `GET /api/rbac/roles`
**Purpose**: Get all roles  
**Query Parameters**: `page`, `limit`, `search`

### 13. `GET /api/rbac/roles/:roleId`
**Purpose**: Get specific role by ID

### 14. `POST /api/rbac/roles`
**Purpose**: Create new role  
**Body**:
```json
{
  "name": "editor",
  "description": "Content Editor Role",
  "permissions": ["permission_id_1", "permission_id_2"]
}
```

### 15. `PUT /api/rbac/roles/:roleId`
**Purpose**: Update existing role

### 16. `DELETE /api/rbac/roles/:roleId`
**Purpose**: Delete role (soft delete)

### 17. `POST /api/rbac/roles/assign`
**Purpose**: Assign role to user  
**Body**:
```json
{
  "userId": "user_id",
  "roleId": "role_id",
  "expiresAt": "2024-12-31T23:59:59.000Z" // Optional
}
```

### 18. `DELETE /api/rbac/roles/user-role/:userRoleId`
**Purpose**: Remove role from user

---

## 🔑 Permission Management (`/api/rbac/permissions/`)
**Authentication**: Required (Admin JWT)  
**Permission Required**: `system_admin:read/create/update/delete`

### 19. `GET /api/rbac/permissions`
**Purpose**: Get all permissions

### 20. `GET /api/rbac/permissions/:permissionId`
**Purpose**: Get specific permission

### 21. `POST /api/rbac/permissions`
**Purpose**: Create new permission  
**Body**:
```json
{
  "resource": "billing",
  "action": "read",
  "description": "View billing information"
}
```

### 22. `PUT /api/rbac/permissions/:permissionId`
**Purpose**: Update permission

### 23. `DELETE /api/rbac/permissions/:permissionId`
**Purpose**: Delete permission

### 24. `GET /api/rbac/permissions/category/:category`
**Purpose**: Get permissions by category

### 25. `GET /api/rbac/permissions/meta/categories`
**Purpose**: Get all permission categories

### 26. `POST /api/rbac/permissions/bulk`
**Purpose**: Create multiple permissions  
**Body**:
```json
{
  "permissions": [
    {
      "resource": "users",
      "action": "create",
      "description": "Create new users"
    }
  ]
}
```

---

## 🔗 User Role Management (`/api/rbac/user-roles/`)
**Authentication**: Required (Admin JWT)

### 27. `GET /api/rbac/user-roles`
**Purpose**: Get all user-role assignments  
**Permission Required**: `user_management:read`

### 28. `GET /api/rbac/user-roles/user/:userId`
**Purpose**: Get user's roles and permissions  
**Permission Required**: `user_management:read` OR own profile

### 29. `GET /api/rbac/user-roles/check-permission/:userId`
**Purpose**: Check if user has specific permission  
**Query**: `?resource=billing&action=read`

### 30. `GET /api/rbac/user-roles/role/:roleId/users`
**Purpose**: Get all users with specific role

### 31. `PUT /api/rbac/user-roles/:userRoleId`
**Purpose**: Update user role assignment

### 32. `GET /api/rbac/user-roles/statistics`
**Purpose**: Get role assignment statistics  
**Permission Required**: `analytics_reports:read`

### 33. `POST /api/rbac/user-roles/bulk-assign`
**Purpose**: Assign role to multiple users  
**Body**:
```json
{
  "userIds": ["user1", "user2"],
  "roleId": "role_id"
}
```

---

## 📊 Audit & Logging (`/api/rbac/audit/`)
**Authentication**: Required (Admin JWT)

### 34. `GET /api/rbac/audit`
**Purpose**: Get audit logs  
**Permission Required**: `security_settings:read`  
**Query Parameters**: `startDate`, `endDate`, `action`, `userId`

### 35. `GET /api/rbac/audit/statistics`
**Purpose**: Get audit statistics  
**Permission Required**: `analytics_reports:read`

### 36. `GET /api/rbac/audit/user/:userId`
**Purpose**: Get user activity logs  
**Permission Required**: `security_settings:read` OR own logs

### 37. `GET /api/rbac/audit/security-events`
**Purpose**: Get security-related events  
**Permission Required**: `security_settings:read`

---

## 👤 Admin User Management (`/api/rbac/users/`)
**Authentication**: Required (Admin JWT)

### 38. `GET /api/rbac/users`
**Purpose**: Get all admin users  
**Permission Required**: `user_management:read`  
**Query**: `page`, `limit`, `search`, `adminLevel`, `department`

### 39. `GET /api/rbac/users/statistics`
**Purpose**: Get admin user statistics  
**Permission Required**: `analytics_reports:read`

### 40. `GET /api/rbac/users/:adminUserId`
**Purpose**: Get admin user by ID  
**Permission Required**: `user_management:read` OR own profile

### 41. `POST /api/rbac/users`
**Purpose**: Create new admin user  
**Permission Required**: `user_management:create`  
**Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "tempPassword123",
  "adminLevel": "admin",
  "department": "IT"
}
```

### 42. `PUT /api/rbac/users/:adminUserId`
**Purpose**: Update admin user  
**Permission Required**: `user_management:update` OR own profile

### 43. `DELETE /api/rbac/users/:adminUserId`
**Purpose**: Delete admin user (soft delete)  
**Permission Required**: `user_management:delete`

### 44. `POST /api/rbac/users/:adminUserId/change-password`
**Purpose**: Change user password  
**Permission Required**: `user_management:update` OR own account

### 45. `POST /api/rbac/users/:adminUserId/reset-password`
**Purpose**: Reset user password  
**Permission Required**: `user_management:update`

---

## 🏥 System Health (`/api/rbac/`)

### 46. `GET /api/rbac/health`
**Purpose**: RBAC system health check  
**Authentication**: Not required

---

## 🔒 Permission Categories

### Available Permission Resources:
- `user_management` - User operations
- `system_admin` - System administration
- `security_settings` - Security configurations
- `analytics_reports` - Reporting and analytics
- `billing_settings` - Billing operations
- `content_management` - Content operations

### Available Actions:
- `read` - View/List operations
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Remove resources
- `manage` - Full control (create, read, update, delete)

---

## 🛡️ Admin Levels Hierarchy
1. **super_admin** - Full system access (bypasses all permission checks)
2. **finance_admin** - Financial operations and reporting
3. **growth_marketing** - Marketing and user engagement
4. **support** - Customer support operations
5. **read_only** - View-only access

---

## 🔧 Common Issues Fixed

### 1. **Authentication Middleware Issues**
- ✅ Fixed incorrect middleware imports in all route files
- ✅ Updated to use admin-specific authentication middleware
- ✅ Added proper RBAC permission injection

### 2. **Permission Check Implementation**
- ✅ Added proper permission checks to all admin user routes
- ✅ Implemented self-access logic (users can access their own data)
- ✅ Added comprehensive RBAC middleware integration

### 3. **Route Structure Improvements**
- ✅ Consistent error handling across all endpoints
- ✅ Proper status codes and response formats
- ✅ Enhanced security with permission-based access control

### 4. **Security Enhancements**
- ✅ Rate limiting for sensitive operations
- ✅ Comprehensive audit logging
- ✅ 2FA support implementation
- ✅ Secure token handling with multiple cookie support

---

## 📝 Usage Examples

### Authentication Flow:
```bash
# 1. Login
curl -X POST /api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# 2. Use returned token for subsequent requests
curl -X GET /api/rbac/users \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Create Admin User:
```bash
curl -X POST /api/rbac/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith", 
    "email": "jane@example.com",
    "username": "janesmith",
    "password": "tempPass123",
    "adminLevel": "admin",
    "department": "Support"
  }'
```

All endpoints are now properly secured with authentication and permission-based access control!