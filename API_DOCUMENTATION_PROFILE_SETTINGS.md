# Backend API Endpoints - Profile & Settings

## Overview

This document lists all the backend API endpoints created for Profile and Settings functionality in the Eagle Dashboard Admin Panel.

## Base URL

All endpoints are prefixed with: `/api/admin`

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Profile Endpoints

### 1. Get Profile

**GET** `/api/admin/profile`

**Description:** Get current authenticated admin user's profile

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "userId",
    "fullName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "phone": "+1234567890",
    "bio": "Admin bio",
    "company": "technology",
    "location": "New York",
    "website": "https://example.com",
    "position": "super_admin",
    "profilePicture": "https://...",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "lastLoginAt": "2024-01-01T00:00:00.000Z",
    "isEmailVerified": true,
    "isTwoFactorEnabled": false
  }
}
```

---

### 2. Update Profile

**PUT** `/api/admin/profile`

**Description:** Update current user's profile information

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "bio": "Updated bio",
  "company": "technology",
  "location": "New York",
  "website": "https://example.com",
  "position": "super_admin"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    // Updated profile object
  }
}
```

---

### 3. Upload Avatar

**POST** `/api/admin/profile/avatar`

**Description:** Upload profile picture/avatar

**Content-Type:** `multipart/form-data`

**Request Body:**

- **avatar** (file): Image file (jpg, jpeg, png, gif, webp)
- Max size: 5MB

**Response:**

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "profilePicture": "https://cloudinary.com/..."
  }
}
```

**Notes:**

- Supports Cloudinary upload (if configured)
- Falls back to local storage if Cloudinary not available
- Old avatar is automatically deleted when uploading new one

---

### 4. Change Password

**POST** `/api/admin/profile/change-password`

**Description:** Change user's password

**Request Body:**

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Validation:**

- Current password must be correct
- New password must be at least 8 characters

---

### 5. Get Account Stats

**GET** `/api/admin/profile/stats`

**Description:** Get account statistics and activity metrics

**Response:**

```json
{
  "success": true,
  "data": {
    "totalActions": 150,
    "recentActions": 25,
    "activeSessions": 1,
    "lastLogin": "2024-01-01T00:00:00.000Z",
    "accountCreated": "2023-01-01T00:00:00.000Z",
    "loginCount": 0,
    "emailVerified": true,
    "twoFactorEnabled": false
  }
}
```

---

### 6. Get Activity Log

**GET** `/api/admin/profile/activity?limit=10`

**Description:** Get user's recent activity log

**Query Parameters:**

- **limit** (optional): Number of activities to return (default: 10)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "activityId",
      "action": "update",
      "resource": "profile",
      "resourceId": "resourceId",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "ipAddress": "192.168.1.1",
      "description": "update profile",
      "details": {
        /* change details */
      }
    }
  ]
}
```

---

## Settings Endpoints

### 1. Get Settings

**GET** `/api/admin/settings`

**Description:** Get all settings for current user

**Response:**

```json
{
  "success": true,
  "data": {
    "theme": "light",
    "language": "en",
    "timezone": "UTC",
    "notifications": {
      "email": true,
      "push": true,
      "sms": false,
      "reports": true,
      "alerts": true,
      "updates": true,
      "newsletter": false
    },
    "privacy": {
      "profileVisibility": "team",
      "showEmail": false,
      "showActivity": true,
      "allowMessages": true
    },
    "security": {
      "twoFactorEnabled": false,
      "loginAlerts": true,
      "sessionTimeout": 30,
      "passwordLastChanged": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### 2. Update Notification Settings

**PUT** `/api/admin/settings/notifications`

**Description:** Update notification preferences

**Request Body:**

```json
{
  "email": true,
  "push": true,
  "sms": false,
  "reports": true,
  "alerts": true,
  "updates": true,
  "newsletter": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Notification settings updated successfully",
  "data": {
    "email": true,
    "push": true,
    "sms": false,
    "reports": true,
    "alerts": true,
    "updates": true,
    "newsletter": false
  }
}
```

---

### 3. Update Privacy Settings

**PUT** `/api/admin/settings/privacy`

**Description:** Update privacy settings

**Request Body:**

```json
{
  "profileVisibility": "team",
  "showEmail": false,
  "showActivity": true,
  "allowMessages": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Privacy settings updated successfully",
  "data": {
    "profileVisibility": "team",
    "showEmail": false,
    "showActivity": true,
    "allowMessages": true
  }
}
```

**Profile Visibility Options:**

- `public`: Visible to everyone
- `team`: Visible to team members only
- `private`: Only visible to you

---

### 4. Update Security Settings

**PUT** `/api/admin/settings/security`

**Description:** Update security settings

**Request Body:**

```json
{
  "loginAlerts": true,
  "sessionTimeout": 30
}
```

**Response:**

```json
{
  "success": true,
  "message": "Security settings updated successfully",
  "data": {
    "loginAlerts": true,
    "sessionTimeout": 30
  }
}
```

---

### 5. Toggle Two-Factor Authentication

**POST** `/api/admin/settings/2fa`

**Description:** Enable or disable 2FA

**Request Body:**

```json
{
  "enable": true,
  "secret": "optional-secret-key"
}
```

**Response (Enable):**

```json
{
  "success": true,
  "message": "2FA enabled successfully",
  "data": {
    "twoFactorEnabled": true,
    "secret": "generated-secret-key"
  }
}
```

**Response (Disable):**

```json
{
  "success": true,
  "message": "2FA disabled successfully",
  "data": {
    "twoFactorEnabled": false
  }
}
```

---

### 6. Change Password (Settings)

**POST** `/api/admin/settings/change-password`

**Description:** Change password from settings page

**Request Body:**

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 7. Export User Data

**GET** `/api/admin/settings/export-data`

**Description:** Export all user data (GDPR compliance)

**Response:**

```json
{
  "success": true,
  "message": "Data exported successfully",
  "data": {
    "profile": {
      /* full profile data */
    },
    "settings": {
      /* all settings */
    },
    "activities": [
      /* recent activities */
    ],
    "exportedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Frontend Usage:**

```javascript
const data = await settingsService.exportData();
// Creates a downloadable JSON file
const blob = new Blob([JSON.stringify(data, null, 2)], {
  type: "application/json",
});
const url = URL.createObjectURL(blob);
// Trigger download
```

---

### 8. Delete Account

**POST** `/api/admin/settings/delete-account`

**Description:** Delete account (soft delete - deactivates account)

**Request Body:**

```json
{
  "password": "confirmPassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Notes:**

- Requires password confirmation
- Super admin accounts cannot be deleted
- This is a soft delete (account is deactivated, not permanently deleted)

---

### 9. Get Active Sessions

**GET** `/api/admin/settings/sessions`

**Description:** Get list of active login sessions

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "sessionId",
      "device": "Mozilla/5.0...",
      "location": "192.168.1.1",
      "lastActive": "2024-01-01T00:00:00.000Z",
      "current": true
    }
  ]
}
```

---

### 10. Revoke Session

**DELETE** `/api/admin/settings/sessions/:sessionId`

**Description:** Revoke/logout a specific session

**Response:**

```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

**Notes:**

- Cannot revoke current session
- Session ID should not be 'current'

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request

```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Invalid credentials or password incorrect"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "You don't have permission to perform this action"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Failed to perform operation",
  "error": "Detailed error message (only in development)"
}
```

---

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Password Verification**: Password change and account deletion require current password
3. **Audit Logging**: All changes are logged to audit trail
4. **File Upload Security**:
   - File type validation (images only)
   - File size limit (5MB)
   - Automatic old file cleanup
5. **Super Admin Protection**: Super admin accounts cannot be deleted
6. **Session Management**: Track and revoke sessions

---

## Database Models

### AdminUser Model Fields Used:

- firstName, lastName, email, username
- phone, bio, department
- profilePicture
- password, passwordChangedAt
- isTwoFactorEnabled, twoFactorSecret
- isActive, isEmailVerified
- lastLoginAt, lastLoginIP
- metadata (stores additional settings)
- createdAt, updatedAt

### Settings Storage:

Settings are stored in `adminUser.metadata.settings`:

```javascript
{
  theme: "light",
  emailNotifications: true,
  pushNotifications: true,
  // ... other settings
}
```

---

## Testing Endpoints

### Using cURL:

```bash
# Get Profile
curl -X GET http://localhost:3000/api/admin/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update Profile
curl -X PUT http://localhost:3000/api/admin/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe"}'

# Upload Avatar
curl -X POST http://localhost:3000/api/admin/profile/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "avatar=@/path/to/image.jpg"

# Change Password
curl -X POST http://localhost:3000/api/admin/profile/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"old","newPassword":"new123456"}'
```

### Using Postman:

1. Set Authorization header: `Bearer YOUR_JWT_TOKEN`
2. For file uploads: Use form-data with key "avatar"
3. For JSON requests: Set Content-Type to `application/json`

---

## Frontend Integration

All these endpoints are consumed by:

- **Profile Service**: `src/lib/services/profile.service.ts`
- **Settings Service**: `src/lib/services/settings.service.ts`
- **Profile Page**: `app/(dashboard)/profile/page.tsx`
- **Settings Page**: `app/(dashboard)/settings/page.tsx`

---

## Implementation Status

✅ **Completed:**

- All 16 API endpoints implemented
- Profile controller with 6 methods
- Settings controller with 10 methods
- Profile routes file
- Settings routes file
- Routes registered in admin index
- File upload middleware configured
- Cloudinary integration with local fallback
- Audit logging for all actions
- Error handling and validation
- Security measures implemented

✅ **Ready for Testing:**
All endpoints are functional and ready to be tested with the frontend.
