# Admin Dashboard API Documentation

Complete API documentation for the Eagle Backend Admin Dashboard system.

**Base URL:** `/api/admin`

---

## Table of Contents

1. [Authentication APIs](#authentication-apis)
2. [Admin User Management APIs](#admin-user-management-apis)
3. [Role Management APIs](#role-management-apis)
4. [Permission Management APIs](#permission-management-apis)
5. [User Role Management APIs](#user-role-management-apis)
6. [Audit Log APIs](#audit-log-apis)
7. [Payment Gateway Management APIs](#payment-gateway-management-apis)
8. [Health Check](#health-check)

---

## Authentication APIs

Base Path: `/api/admin/auth`

### 1. Admin Login

**Endpoint:** `POST /api/admin/auth/login`

**Description:** Authenticate admin user with enhanced security features including 2FA, account lockouts, and login attempt tracking.

**Rate Limited:** Yes

**Request Body:**

```json
{
  "email": "admin@example.com", // Optional (use email OR username)
  "username": "adminuser", // Optional (use email OR username)
  "password": "SecurePass123!", // Required
  "twoFactorCode": "123456" // Optional (required if 2FA enabled)
}
```

**Response (Success - No 2FA):**

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "email": "admin@example.com",
    "username": "adminuser",
    "adminLevel": "super_admin",
    "department": "Engineering",
    "permissions": ["user_management:read", "user_management:create"],
    "profilePicture": "https://...",
    "forcePasswordChange": false,
    "isTwoFactorEnabled": false,
    "lastLoginAt": "2025-11-06T10:30:00.000Z"
  },
  "expiresIn": 28800
}
```

**Response (2FA Required):**

```json
{
  "success": false,
  "requiresTwoFactor": true,
  "email": "admin@example.com",
  "message": "Two-factor authentication code required"
}
```

**Response (Account Locked - 423):**

```json
{
  "success": false,
  "message": "Account is locked due to too many failed login attempts. Please try again later.",
  "lockUntil": "2025-11-06T11:00:00.000Z"
}
```

**Response (Invalid Credentials - 401):**

```json
{
  "success": false,
  "message": "Invalid credentials",
  "attemptsRemaining": 3
}
```

---

### 2. Complete Login with 2FA

**Endpoint:** `POST /api/admin/auth/login-2fa`

**Description:** Complete the login process by providing the two-factor authentication code.

**Rate Limited:** Yes

**Request Body:**

```json
{
  "email": "admin@example.com",
  "token": "123456" // 6-digit TOTP code or 8-character backup code
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Two-factor authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "email": "admin@example.com",
    "username": "adminuser",
    "adminLevel": "super_admin",
    "department": "Engineering",
    "permissions": ["user_management:read"],
    "profilePicture": "https://...",
    "forcePasswordChange": false,
    "isTwoFactorEnabled": true,
    "lastLoginAt": "2025-11-06T10:30:00.000Z"
  },
  "usedBackupCode": false,
  "expiresIn": 28800
}
```

**Response (Invalid Token - 401):**

```json
{
  "success": false,
  "message": "Invalid authentication code"
}
```

---

### 3. Get Admin Profile

**Endpoint:** `GET /api/admin/auth/profile`

**Authentication:** Required (Bearer Token)

**Response (Success - 200):**

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "email": "admin@example.com",
    "username": "adminuser",
    "phone": "+1234567890",
    "adminLevel": "super_admin",
    "department": "Engineering",
    "employeeId": "EMP001",
    "permissions": ["user_management:read", "user_management:create"],
    "bio": "Senior System Administrator",
    "profilePicture": "https://...",
    "isActive": true,
    "isTwoFactorEnabled": true,
    "forcePasswordChange": false,
    "lastLoginAt": "2025-11-06T10:30:00.000Z",
    "lastLoginIP": "192.168.1.1",
    "loginAttempts": 0,
    "createdBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com",
      "username": "superadmin"
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-11-06T10:30:00.000Z"
  }
}
```

---

### 4. Setup Two-Factor Authentication

**Endpoint:** `POST /api/admin/auth/setup-2fa`

**Authentication:** Required (Bearer Token)

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "backupCodes": [],
    "manualEntryKey": "JBSWY3DPEHPK3PXP"
  }
}
```

**Response (Already Enabled - 400):**

```json
{
  "success": false,
  "message": "Two-factor authentication is already enabled"
}
```

---

### 5. Confirm 2FA Setup

**Endpoint:** `POST /api/admin/auth/confirm-2fa`

**Authentication:** Required (Bearer Token)

**Request Body:**

```json
{
  "token": "123456" // 6-digit verification code from authenticator app
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

**Response (Invalid Token - 400):**

```json
{
  "success": false,
  "message": "Invalid verification token"
}
```

---

### 6. Disable Two-Factor Authentication

**Endpoint:** `POST /api/admin/auth/disable-2fa`

**Authentication:** Required (Bearer Token)

**Request Body:**

```json
{
  "password": "CurrentPassword123!",
  "token": "123456" // Current 6-digit TOTP code
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

**Response (Invalid Password/Token - 401):**

```json
{
  "success": false,
  "message": "Invalid password" // or "Invalid 2FA token"
}
```

---

### 7. Change Password

**Endpoint:** `POST /api/admin/auth/change-password`

**Authentication:** Required (Bearer Token)

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Response (Invalid Current Password - 401):**

```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

---

### 8. Forgot Password

**Endpoint:** `POST /api/admin/auth/forgot-password`

**Rate Limited:** Yes

**Request Body:**

```json
{
  "email": "admin@example.com"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent",
  "resetToken": "abc123def456..." // Only in development mode
}
```

---

### 9. Reset Password

**Endpoint:** `POST /api/admin/auth/reset-password/:token`

**Parameters:**

- `token` (path) - Password reset token

**Request Body:**

```json
{
  "password": "NewSecurePassword123!"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Response (Invalid/Expired Token - 400):**

```json
{
  "success": false,
  "message": "Token is invalid or has expired"
}
```

---

### 10. Validate Token

**Endpoint:** `GET /api/admin/auth/validate-token`

**Authentication:** Required (Bearer Token)

**Response (Valid Token - 200):**

```json
{
  "valid": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "admin@example.com",
    "username": "adminuser",
    "adminLevel": "super_admin",
    "department": "Engineering",
    "type": "admin"
  }
}
```

**Response (Invalid Token - 401):**

```json
{
  "valid": false,
  "message": "Invalid token"
}
```

---

### 11. Logout

**Endpoint:** `POST /api/admin/auth/logout`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## Admin User Management APIs

Base Path: `/api/admin/users`

**Authentication:** Required for all endpoints

### 1. Get All Admin Users

**Endpoint:** `GET /api/admin/users`

**Permission Required:** `user_management:read`

**Query Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 10) - Items per page
- `search` (string) - Search by name, email, or username
- `adminLevel` (string) - Filter by admin level
- `department` (string) - Filter by department
- `isActive` (boolean) - Filter by active status

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "adminUsers": [
      {
        "id": "507f1f77bcf86cd799439011",
        "firstName": "John",
        "lastName": "Doe",
        "fullName": "John Doe",
        "email": "admin@example.com",
        "username": "adminuser",
        "phone": "+1234567890",
        "adminLevel": "super_admin",
        "department": "Engineering",
        "employeeId": "EMP001",
        "permissions": ["user_management:read"],
        "bio": "Senior System Administrator",
        "profilePicture": "https://...",
        "isActive": true,
        "isTwoFactorEnabled": true,
        "forcePasswordChange": false,
        "lastLoginAt": "2025-11-06T10:30:00.000Z",
        "createdBy": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com",
          "username": "superadmin"
        },
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "adminHierarchy": {
      "super_admin": 1,
      "finance_admin": 2,
      "growth_marketing": 3,
      "support": 4,
      "read_only": 5
    },
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 50
    }
  }
}
```

---

### 2. Get Admin User by ID

**Endpoint:** `GET /api/admin/users/:adminUserId`

**Permission Required:** `user_management:read` OR own profile

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "email": "admin@example.com",
    "username": "adminuser",
    "phone": "+1234567890",
    "adminLevel": "super_admin",
    "department": "Engineering",
    "employeeId": "EMP001",
    "permissions": ["user_management:read", "user_management:create"],
    "bio": "Senior System Administrator",
    "profilePicture": "https://...",
    "isActive": true,
    "isTwoFactorEnabled": true,
    "forcePasswordChange": false,
    "lastLoginAt": "2025-11-06T10:30:00.000Z",
    "lastLoginIP": "192.168.1.1",
    "loginAttempts": 0,
    "createdBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com",
      "username": "superadmin"
    },
    "updatedBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com",
      "username": "superadmin"
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-11-06T10:30:00.000Z"
  }
}
```

---

### 3. Create Admin User

**Endpoint:** `POST /api/admin/users`

**Permission Required:** `user_management:create`

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "username": "janesmith",
  "password": "SecurePass123!",
  "phone": "+1234567890",
  "adminLevel": "finance_admin",
  "department": "Finance",
  "employeeId": "EMP002",
  "permissions": ["analytics_reports:read"],
  "bio": "Finance Department Lead"
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "Admin user created successfully",
  "data": {
    "adminUser": {
      "id": "507f1f77bcf86cd799439012",
      "firstName": "Jane",
      "lastName": "Smith",
      "fullName": "Jane Smith",
      "email": "jane.smith@example.com",
      "username": "janesmith",
      "phone": "+1234567890",
      "adminLevel": "finance_admin",
      "department": "Finance",
      "employeeId": "EMP002",
      "permissions": ["analytics_reports:read"],
      "bio": "Finance Department Lead",
      "isActive": true,
      "forcePasswordChange": true,
      "isTwoFactorEnabled": false,
      "createdAt": "2025-11-06T10:30:00.000Z"
    },
    "activationToken": "abc123def456..."
  }
}
```

**Response (User Already Exists - 400):**

```json
{
  "success": false,
  "message": "Admin user with this email or username already exists"
}
```

---

### 4. Update Admin User

**Endpoint:** `PUT /api/admin/users/:adminUserId`

**Permission Required:** `user_management:update` OR own profile

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith-Johnson",
  "phone": "+1234567891",
  "adminLevel": "growth_marketing",
  "department": "Marketing",
  "employeeId": "EMP002",
  "permissions": ["analytics_reports:read", "user_management:read"],
  "bio": "Marketing Department Lead",
  "isActive": true,
  "isTwoFactorEnabled": false
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Admin user updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "firstName": "Jane",
    "lastName": "Smith-Johnson",
    "fullName": "Jane Smith-Johnson",
    "email": "jane.smith@example.com",
    "username": "janesmith",
    "phone": "+1234567891",
    "adminLevel": "growth_marketing",
    "department": "Marketing",
    "employeeId": "EMP002",
    "permissions": ["analytics_reports:read", "user_management:read"],
    "bio": "Marketing Department Lead",
    "isActive": true,
    "isTwoFactorEnabled": false,
    "updatedBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com",
      "username": "superadmin"
    },
    "updatedAt": "2025-11-06T10:35:00.000Z"
  }
}
```

---

### 5. Delete Admin User

**Endpoint:** `DELETE /api/admin/users/:adminUserId`

**Permission Required:** `user_management:delete`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Admin user deleted successfully"
}
```

**Response (Cannot Delete Own Account - 400):**

```json
{
  "success": false,
  "message": "Cannot delete your own account"
}
```

---

### 6. Change Admin User Password

**Endpoint:** `POST /api/admin/users/:adminUserId/change-password`

**Permission Required:** `user_management:update` OR own account

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 7. Reset Admin User Password

**Endpoint:** `POST /api/admin/users/:adminUserId/reset-password`

**Permission Required:** `user_management:update`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "tempPassword": "a1b2c3d4e5f6...",
    "message": "User must change password on next login"
  }
}
```

---

### 8. Get Admin Statistics

**Endpoint:** `GET /api/admin/users/statistics`

**Permission Required:** `analytics_reports:read`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 50,
      "active": 45,
      "inactive": 5,
      "recentLogins": 30
    },
    "byAdminLevel": [
      {
        "_id": "super_admin",
        "count": 5,
        "active": 5,
        "inactive": 0
      },
      {
        "_id": "finance_admin",
        "count": 10,
        "active": 9,
        "inactive": 1
      }
    ],
    "byDepartment": [
      {
        "_id": "Engineering",
        "count": 20
      },
      {
        "_id": "Finance",
        "count": 10
      }
    ],
    "adminHierarchy": {
      "super_admin": 1,
      "finance_admin": 2,
      "growth_marketing": 3,
      "support": 4,
      "read_only": 5
    }
  }
}
```

---

## Role Management APIs

Base Path: `/api/admin/roles`

**Authentication:** Required for all endpoints

### 1. Get All Roles

**Endpoint:** `GET /api/admin/roles`

**Permission Required:** `user_management:read`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) - Search by name or display name
- `isActive` (boolean) - Filter by active status

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "content_editor",
        "displayName": "Content Editor",
        "description": "Can create and edit content",
        "permissions": [
          {
            "id": "507f1f77bcf86cd799439020",
            "name": "content_management:create",
            "displayName": "Create Content",
            "description": "Permission to create new content",
            "category": "content_management",
            "resource": "content_management",
            "action": "create"
          }
        ],
        "isActive": true,
        "createdBy": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com"
        },
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 3,
      "total": 25
    }
  }
}
```

---

### 2. Get Role by ID

**Endpoint:** `GET /api/admin/roles/:roleId`

**Permission Required:** `user_management:read`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "role": {
      "id": "507f1f77bcf86cd799439013",
      "name": "content_editor",
      "displayName": "Content Editor",
      "description": "Can create and edit content",
      "permissions": [
        {
          "id": "507f1f77bcf86cd799439020",
          "name": "content_management:create",
          "displayName": "Create Content",
          "description": "Permission to create new content",
          "category": "content_management",
          "resource": "content_management",
          "action": "create"
        }
      ],
      "isActive": true,
      "createdBy": {
        "firstName": "Super",
        "lastName": "Admin",
        "email": "superadmin@example.com"
      },
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    "assignedUsers": [
      {
        "userId": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "assignedAt": "2025-11-01T10:00:00.000Z",
        "assignedBy": "507f1f77bcf86cd799439011"
      }
    ]
  }
}
```

---

### 3. Create Role

**Endpoint:** `POST /api/admin/roles`

**Permission Required:** `user_management:create`

**Request Body:**

```json
{
  "name": "content_editor",
  "displayName": "Content Editor",
  "description": "Can create and edit content",
  "permissions": ["507f1f77bcf86cd799439020", "507f1f77bcf86cd799439021"]
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "name": "content_editor",
    "displayName": "Content Editor",
    "description": "Can create and edit content",
    "permissions": [
      {
        "id": "507f1f77bcf86cd799439020",
        "name": "content_management:create",
        "displayName": "Create Content"
      }
    ],
    "isActive": true,
    "createdBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "createdAt": "2025-11-06T10:30:00.000Z"
  }
}
```

---

### 4. Update Role

**Endpoint:** `PUT /api/admin/roles/:roleId`

**Permission Required:** `user_management:update`

**Request Body:**

```json
{
  "displayName": "Senior Content Editor",
  "description": "Can create, edit, and publish content",
  "permissions": [
    "507f1f77bcf86cd799439020",
    "507f1f77bcf86cd799439021",
    "507f1f77bcf86cd799439022"
  ],
  "isActive": true
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Role updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "name": "content_editor",
    "displayName": "Senior Content Editor",
    "description": "Can create, edit, and publish content",
    "permissions": [
      {
        "id": "507f1f77bcf86cd799439020",
        "name": "content_management:create",
        "displayName": "Create Content"
      }
    ],
    "isActive": true,
    "updatedBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "updatedAt": "2025-11-06T10:35:00.000Z"
  }
}
```

---

### 5. Delete Role

**Endpoint:** `DELETE /api/admin/roles/:roleId`

**Permission Required:** `user_management:delete`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

**Response (Role in Use - 400):**

```json
{
  "success": false,
  "message": "Cannot delete role. It is assigned to 5 user(s)",
  "data": {
    "assignedUsersCount": 5
  }
}
```

---

### 6. Assign Role to User

**Endpoint:** `POST /api/admin/roles/assign`

**Permission Required:** `user_management:update`

**Request Body:**

```json
{
  "userId": "507f1f77bcf86cd799439014",
  "roleId": "507f1f77bcf86cd799439013",
  "expiresAt": "2026-01-01T00:00:00.000Z", // Optional
  "notes": "Temporary content editor role for Q1 2026"
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "Role assigned to user successfully",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "userId": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "roleId": {
      "name": "content_editor",
      "displayName": "Content Editor",
      "permissions": []
    },
    "assignedBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "assignedAt": "2025-11-06T10:30:00.000Z",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "notes": "Temporary content editor role for Q1 2026",
    "isActive": true
  }
}
```

---

### 7. Remove Role from User

**Endpoint:** `DELETE /api/admin/roles/user-role/:userRoleId`

**Permission Required:** `user_management:update`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Role removed from user successfully"
}
```

---

## Permission Management APIs

Base Path: `/api/admin/permissions`

**Authentication:** Required for all endpoints

### 1. Get All Permissions

**Endpoint:** `GET /api/admin/permissions`

**Permission Required:** `system_admin:read`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 50)
- `search` (string) - Search by name, display name, or resource
- `category` (string) - Filter by category
- `isActive` (boolean) - Filter by active status

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "permissions": [
      {
        "id": "507f1f77bcf86cd799439020",
        "name": "user_management:read",
        "displayName": "Read Users",
        "description": "Permission to view user information",
        "category": "user_management",
        "resource": "user_management",
        "action": "read",
        "isActive": true,
        "createdBy": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com"
        },
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "groupedPermissions": {
      "user_management": [
        {
          "id": "507f1f77bcf86cd799439020",
          "name": "user_management:read",
          "displayName": "Read Users"
        }
      ],
      "analytics_reports": []
    },
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 200
    }
  }
}
```

---

### 2. Get Permission by ID

**Endpoint:** `GET /api/admin/permissions/:permissionId`

**Permission Required:** `system_admin:read`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439020",
    "name": "user_management:read",
    "displayName": "Read Users",
    "description": "Permission to view user information",
    "category": "user_management",
    "resource": "user_management",
    "action": "read",
    "isActive": true,
    "createdBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 3. Create Permission

**Endpoint:** `POST /api/admin/permissions`

**Permission Required:** `system_admin:create`

**Request Body:**

```json
{
  "name": "content_management:publish",
  "displayName": "Publish Content",
  "description": "Permission to publish content to production",
  "category": "content_management",
  "resource": "content_management",
  "action": "publish"
}
```

**Response (Success - 201):**

```json
{
  "success": true,
  "message": "Permission created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439021",
    "name": "content_management:publish",
    "displayName": "Publish Content",
    "description": "Permission to publish content to production",
    "category": "content_management",
    "resource": "content_management",
    "action": "publish",
    "isActive": true,
    "createdBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "createdAt": "2025-11-06T10:30:00.000Z"
  }
}
```

---

### 4. Update Permission

**Endpoint:** `PUT /api/admin/permissions/:permissionId`

**Permission Required:** `system_admin:update`

**Request Body:**

```json
{
  "displayName": "Publish Content to Production",
  "description": "Permission to publish content to production environment",
  "category": "content_management",
  "isActive": true
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Permission updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439021",
    "name": "content_management:publish",
    "displayName": "Publish Content to Production",
    "description": "Permission to publish content to production environment",
    "category": "content_management",
    "resource": "content_management",
    "action": "publish",
    "isActive": true,
    "createdBy": {
      "firstName": "Super",
      "lastName": "Admin",
      "email": "superadmin@example.com"
    },
    "updatedAt": "2025-11-06T10:35:00.000Z"
  }
}
```

---

### 5. Delete Permission

**Endpoint:** `DELETE /api/admin/permissions/:permissionId`

**Permission Required:** `system_admin:delete`

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Permission deleted successfully"
}
```

---

### 6. Get Permissions by Category

**Endpoint:** `GET /api/admin/permissions/category/:category`

**Permission Required:** `system_admin:read`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "category": "user_management",
    "permissions": [
      {
        "id": "507f1f77bcf86cd799439020",
        "name": "user_management:read",
        "displayName": "Read Users",
        "description": "Permission to view user information",
        "category": "user_management",
        "resource": "user_management",
        "action": "read",
        "isActive": true
      }
    ]
  }
}
```

---

### 7. Get All Categories

**Endpoint:** `GET /api/admin/permissions/meta/categories`

**Permission Required:** `system_admin:read`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": [
    "user_management",
    "analytics_reports",
    "content_management",
    "payment_settings",
    "security_settings",
    "system_admin"
  ]
}
```

---

### 8. Bulk Create Permissions

**Endpoint:** `POST /api/admin/permissions/bulk`

**Permission Required:** `system_admin:create`

**Request Body:**

```json
{
  "permissions": [
    {
      "name": "reports:generate",
      "displayName": "Generate Reports",
      "description": "Permission to generate system reports",
      "category": "analytics_reports",
      "resource": "reports",
      "action": "generate"
    },
    {
      "name": "reports:export",
      "displayName": "Export Reports",
      "description": "Permission to export reports",
      "category": "analytics_reports",
      "resource": "reports",
      "action": "export"
    }
  ]
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Bulk permission creation completed. Created: 2, Skipped: 0, Errors: 0",
  "data": {
    "created": [
      {
        "id": "507f1f77bcf86cd799439022",
        "name": "reports:generate",
        "displayName": "Generate Reports"
      }
    ],
    "skipped": [],
    "errors": []
  }
}
```

---

## User Role Management APIs

Base Path: `/api/admin/user-roles`

**Authentication:** Required for all endpoints

### 1. Get All User Role Assignments

**Endpoint:** `GET /api/admin/user-roles`

**Permission Required:** `user_management:read`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) - Search by user name or email
- `roleId` (string) - Filter by role
- `isActive` (boolean, default: true) - Filter by active status

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "userRoles": [
      {
        "id": "507f1f77bcf86cd799439030",
        "userId": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "roleId": {
          "name": "content_editor",
          "displayName": "Content Editor",
          "permissions": []
        },
        "assignedBy": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com"
        },
        "assignedAt": "2025-11-01T10:00:00.000Z",
        "expiresAt": "2026-01-01T00:00:00.000Z",
        "notes": "Temporary assignment",
        "isActive": true
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 3,
      "total": 25
    }
  }
}
```

---

### 2. Get User's Roles and Permissions

**Endpoint:** `GET /api/admin/user-roles/user/:userId`

**Permission Required:** `user_management:read` OR own profile

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439014",
    "isSuperAdmin": false,
    "roles": [
      {
        "id": "507f1f77bcf86cd799439030",
        "roleId": {
          "name": "content_editor",
          "displayName": "Content Editor",
          "permissions": [
            {
              "name": "content_management:create",
              "displayName": "Create Content"
            }
          ]
        },
        "assignedBy": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com"
        },
        "assignedAt": "2025-11-01T10:00:00.000Z",
        "expiresAt": null,
        "isActive": true
      }
    ],
    "permissions": [
      {
        "name": "content_management:create",
        "displayName": "Create Content",
        "category": "content_management",
        "resource": "content_management",
        "action": "create"
      }
    ],
    "roleCount": 1,
    "permissionCount": 1
  }
}
```

---

### 3. Check User Permission

**Endpoint:** `GET /api/admin/user-roles/check-permission/:userId`

**Permission Required:** `user_management:read`

**Query Parameters:**

- `resource` (string, required) - Resource name
- `action` (string, required) - Action name

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439014",
    "resource": "content_management",
    "action": "create",
    "hasPermission": true,
    "isSuperAdmin": false,
    "checkPerformedBy": "507f1f77bcf86cd799439011"
  }
}
```

---

### 4. Get Users by Role

**Endpoint:** `GET /api/admin/user-roles/role/:roleId/users`

**Permission Required:** `user_management:read`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 10)
- `includeExpired` (boolean, default: false)

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "role": {
      "id": "507f1f77bcf86cd799439013",
      "name": "content_editor",
      "displayName": "Content Editor"
    },
    "userRoles": [
      {
        "id": "507f1f77bcf86cd799439030",
        "userId": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "isActive": true
        },
        "assignedBy": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com"
        },
        "assignedAt": "2025-11-01T10:00:00.000Z",
        "expiresAt": null,
        "isActive": true
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 2,
      "total": 15
    }
  }
}
```

---

### 5. Update User Role Assignment

**Endpoint:** `PUT /api/admin/user-roles/:userRoleId`

**Permission Required:** `user_management:update`

**Request Body:**

```json
{
  "expiresAt": "2026-06-01T00:00:00.000Z",
  "notes": "Extended assignment for project continuation",
  "isActive": true
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "User role assignment updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "userId": {
      "_id": "507f1f77bcf86cd799439014",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "roleId": {
      "name": "content_editor",
      "displayName": "Content Editor"
    },
    "assignedAt": "2025-11-01T10:00:00.000Z",
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "notes": "Extended assignment for project continuation",
    "isActive": true
  }
}
```

---

### 6. Get Role Statistics

**Endpoint:** `GET /api/admin/user-roles/statistics`

**Permission Required:** `analytics_reports:read`

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "roleStatistics": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "roleName": "content_editor",
        "roleDisplayName": "Content Editor",
        "userCount": 15,
        "recentAssignments": 3
      }
    ],
    "summary": {
      "totalUsersWithRoles": 50,
      "totalActiveRoles": 10,
      "totalRoleAssignments": 75
    }
  }
}
```

---

### 7. Bulk Assign Role

**Endpoint:** `POST /api/admin/user-roles/bulk-assign`

**Permission Required:** `user_management:create`

**Request Body:**

```json
{
  "userIds": [
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015",
    "507f1f77bcf86cd799439016"
  ],
  "roleId": "507f1f77bcf86cd799439013",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "notes": "Bulk assignment for new content team"
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Bulk role assignment completed. Assigned: 3, Skipped: 0, Errors: 0",
  "data": {
    "assigned": [
      {
        "id": "507f1f77bcf86cd799439031",
        "userId": "507f1f77bcf86cd799439014",
        "roleId": "507f1f77bcf86cd799439013"
      }
    ],
    "skipped": [],
    "errors": []
  }
}
```

---

## Audit Log APIs

Base Path: `/api/admin/audit`

**Authentication:** Required for all endpoints

### 1. Get Audit Logs

**Endpoint:** `GET /api/admin/audit`

**Permission Required:** `security_settings:read`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 20)
- `userId` (string) - Filter by user
- `action` (string) - Filter by action type
- `resource` (string) - Filter by resource
- `success` (boolean) - Filter by success status
- `startDate` (string, ISO date) - Start date filter
- `endDate` (string, ISO date) - End date filter

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "auditLogs": [
      {
        "id": "507f1f77bcf86cd799439040",
        "userId": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "action": "role_assigned",
        "resource": "user_roles",
        "resourceId": "507f1f77bcf86cd799439030",
        "details": {
          "targetUserId": "507f1f77bcf86cd799439014",
          "roleName": "content_editor"
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "success": true,
        "errorMessage": null,
        "createdAt": "2025-11-06T10:30:00.000Z"
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 10,
      "total": 200
    }
  }
}
```

---

### 2. Get Audit Statistics

**Endpoint:** `GET /api/admin/audit/statistics`

**Permission Required:** `analytics_reports:read`

**Query Parameters:**

- `days` (number, default: 30) - Number of days to analyze

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "actionStatistics": [
      {
        "_id": "role_assigned",
        "total": 50,
        "successful": 48,
        "failed": 2
      },
      {
        "_id": "data_modification",
        "total": 120,
        "successful": 115,
        "failed": 5
      }
    ],
    "topUsers": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "activityCount": 85,
        "user": {
          "firstName": "Super",
          "lastName": "Admin",
          "email": "superadmin@example.com"
        }
      }
    ],
    "summary": {
      "totalLogs": 500,
      "successfulActions": 475,
      "failedActions": 25
    }
  }
}
```

---

### 3. Get User Activity Log

**Endpoint:** `GET /api/admin/audit/user/:userId`

**Permission Required:** `security_settings:read` OR own profile

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 20)
- `action` (string) - Filter by action type
- `days` (number, default: 30) - Number of days to retrieve

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439014",
    "activities": [
      {
        "id": "507f1f77bcf86cd799439041",
        "action": "data_modification",
        "resource": "content_management",
        "resourceId": "507f1f77bcf86cd799439050",
        "details": {
          "contentId": "507f1f77bcf86cd799439050",
          "changes": ["title", "body"]
        },
        "ipAddress": "192.168.1.5",
        "success": true,
        "createdAt": "2025-11-06T09:30:00.000Z"
      }
    ],
    "statistics": [
      {
        "_id": "data_modification",
        "count": 25
      },
      {
        "_id": "permission_check",
        "count": 50
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 100
    }
  }
}
```

---

### 4. Get Security Events

**Endpoint:** `GET /api/admin/audit/security-events`

**Permission Required:** `security_settings:read`

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 20)
- `days` (number, default: 7) - Number of days to retrieve

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "507f1f77bcf86cd799439042",
        "userId": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "action": "access_denied",
        "resource": "user_management",
        "details": {
          "attemptedAction": "delete",
          "reason": "Insufficient permissions"
        },
        "ipAddress": "192.168.1.10",
        "success": false,
        "errorMessage": "Access denied",
        "createdAt": "2025-11-06T08:30:00.000Z"
      }
    ],
    "statistics": [
      {
        "_id": {
          "action": "access_denied",
          "success": false
        },
        "count": 15
      },
      {
        "_id": {
          "action": "login_attempt",
          "success": false
        },
        "count": 5
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 2,
      "total": 20
    }
  }
}
```

---

## Payment Gateway Management APIs

Base Path: `/api/admin/payment-gateways`

**Authentication:** Required for all endpoints
**Role Required:** `admin` or `super_admin`

### 1. Get Gateway Status

**Endpoint:** `GET /api/admin/payment-gateways/status`

**Description:** Get the current status and configuration of all payment gateways.

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "stripe": {
      "enabled": true,
      "mode": "test",
      "configured": true,
      "hasPublishableKey": true,
      "hasSecretKey": true,
      "hasWebhookSecret": true
    },
    "paypal": {
      "enabled": true,
      "mode": "sandbox",
      "configured": true,
      "hasClientId": true,
      "hasClientSecret": true,
      "hasWebhookId": true
    }
  }
}
```

---

### 2. Get Stripe Configuration

**Endpoint:** `GET /api/admin/payment-gateways/stripe`

**Description:** Get Stripe configuration (without exposing secret keys).

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "mode": "test",
    "publishableKey": "pk_test_51J...",
    "hasSecretKey": true,
    "hasWebhookSecret": true,
    "source": "database"
  }
}
```

---

### 3. Get PayPal Configuration

**Endpoint:** `GET /api/admin/payment-gateways/paypal`

**Description:** Get PayPal configuration (without exposing secret keys).

**Response (Success - 200):**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "mode": "sandbox",
    "clientId": "AXxxx...",
    "hasClientSecret": true,
    "webhookId": "WH-xxx...",
    "source": "database"
  }
}
```

---

### 4. Update Stripe Configuration

**Endpoint:** `PUT /api/admin/payment-gateways/stripe`

**Description:** Update Stripe gateway configuration.

**Request Body:**

```json
{
  "enabled": true,
  "mode": "live",
  "publishableKey": "pk_live_51J...",
  "secretKey": "sk_live_51J...",
  "webhookSecret": "whsec_..."
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Stripe settings updated successfully",
  "data": {
    "enabled": true,
    "mode": "live"
  }
}
```

**Response (Validation Error - 400):**

```json
{
  "success": false,
  "message": "Publishable key and secret key are required when enabling Stripe"
}
```

---

### 5. Update PayPal Configuration

**Endpoint:** `PUT /api/admin/payment-gateways/paypal`

**Description:** Update PayPal gateway configuration.

**Request Body:**

```json
{
  "enabled": true,
  "mode": "live",
  "clientId": "AXxxx...",
  "clientSecret": "ELxxx...",
  "webhookId": "WH-xxx..."
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "PayPal settings updated successfully",
  "data": {
    "enabled": true,
    "mode": "live"
  }
}
```

**Response (Validation Error - 400):**

```json
{
  "success": false,
  "message": "Mode must be either \"sandbox\" or \"live\""
}
```

---

### 6. Test Stripe Connection

**Endpoint:** `POST /api/admin/payment-gateways/stripe/test`

**Description:** Test Stripe connection with current or new credentials.

**Request Body:**

```json
{
  "secretKey": "sk_test_51J..." // Optional: test with new key before saving
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Stripe connection test successful",
  "data": {
    "accountId": "acct_xxx...",
    "businessProfile": {
      "name": "Test Business"
    }
  }
}
```

**Response (Connection Failed - 400):**

```json
{
  "success": false,
  "message": "Failed to connect to Stripe",
  "error": "Invalid API key provided"
}
```

---

### 7. Test PayPal Connection

**Endpoint:** `POST /api/admin/payment-gateways/paypal/test`

**Description:** Test PayPal connection with current or new credentials.

**Request Body:**

```json
{
  "clientId": "AXxxx...", // Optional: test with new credentials
  "clientSecret": "ELxxx..." // Optional: test with new credentials
}
```

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "PayPal connection test successful",
  "data": {
    "accountId": "xxx...",
    "merchantId": "xxx..."
  }
}
```

**Response (Connection Failed - 400):**

```json
{
  "success": false,
  "message": "Failed to connect to PayPal",
  "error": "Authentication failed"
}
```

---

## Health Check

### System Health Check

**Endpoint:** `GET /api/admin/health`

**Authentication:** Not required

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "RBAC API is running",
  "timestamp": "2025-11-06T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

## Common Response Codes

### Success Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully

### Client Error Codes

- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `423 Locked` - Account locked

### Server Error Codes

- `500 Internal Server Error` - Server error occurred

---

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens expire after 8 hours for admin sessions.

---

## Permission Categories

### Available Permission Categories:

1. **user_management** - User and role management operations
2. **analytics_reports** - Analytics and reporting access
3. **content_management** - Content creation and editing
4. **payment_settings** - Payment gateway configuration
5. **security_settings** - Security and audit log access
6. **system_admin** - System-level administration

### Permission Actions:

- `read` - View/read access
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Delete resources
- Custom actions specific to resources

---

## Admin Levels Hierarchy

1. **super_admin** (Level 1) - Full system access
2. **finance_admin** (Level 2) - Financial operations
3. **growth_marketing** (Level 3) - Marketing operations
4. **support** (Level 4) - Customer support operations
5. **read_only** (Level 5) - Read-only access

---

## Rate Limiting

The following endpoints have rate limiting:

- `POST /api/admin/auth/login` - 5 requests per 15 minutes
- `POST /api/admin/auth/login-2fa` - 5 requests per 15 minutes
- `POST /api/admin/auth/forgot-password` - 3 requests per hour

---

## Audit Actions

Actions logged in audit system:

- `role_assigned` - Role assigned to user
- `role_removed` - Role removed from user
- `permission_granted` - Permission granted
- `permission_revoked` - Permission revoked
- `permission_check` - Permission check performed
- `data_modification` - Data modified
- `access_denied` - Access attempt denied
- `security_violation` - Security violation detected
- `login_attempt` - Login attempt made

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development mode only)",
  "errors": ["Validation error 1", "Validation error 2"]
}
```

---

## Notes

1. **Security**: All sensitive data (passwords, secret keys) are never returned in responses
2. **Soft Deletes**: Most delete operations are soft deletes (setting `isActive: false`)
3. **Audit Logging**: All administrative actions are logged automatically
4. **2FA**: Two-factor authentication is supported via TOTP (Time-based One-Time Password)
5. **Token Expiry**: Admin tokens expire after 8 hours
6. **Rate Limiting**: Sensitive operations are rate-limited to prevent abuse
7. **RBAC**: Role-Based Access Control with granular permissions
8. **Account Lockout**: Accounts lock after 5 failed login attempts

---

## Changelog

### Version 1.0.0 (2025-11-06)

- Initial admin dashboard API documentation
- Authentication system with 2FA support
- User management with RBAC
- Role and permission management
- Audit logging system
- Payment gateway configuration

---

**Document Last Updated:** November 6, 2025
**API Version:** 1.0.0
**Backend Repository:** eagle-backend2025
