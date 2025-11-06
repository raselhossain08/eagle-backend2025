# Testing Checklist - Profile & Settings API

## Pre-Testing Setup

### 1. Environment Configuration

- [ ] Backend server is running (`npm run dev` in eagle-backend2025)
- [ ] Frontend is running (`npm run dev` in eagle-dashboard2025)
- [ ] Database connection is working
- [ ] User is logged in and has JWT token

### 2. Optional: Cloudinary Setup

- [ ] CLOUDINARY_CLOUD_NAME is set in .env
- [ ] CLOUDINARY_API_KEY is set in .env
- [ ] CLOUDINARY_API_SECRET is set in .env

Note: Avatar uploads will work with local storage even without Cloudinary.

---

## Profile Endpoints Testing

### ✅ 1. Get Profile

**URL:** `GET http://localhost:3000/api/admin/profile`

**Test Steps:**

1. Login to dashboard
2. Navigate to Profile page
3. Verify profile data loads
4. Check all fields are populated

**Expected Result:**

- Profile information displays correctly
- No console errors
- Toast shows success (if implemented)

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 2. Update Profile

**URL:** `PUT http://localhost:3000/api/admin/profile`

**Test Steps:**

1. Go to Profile page
2. Click Edit button
3. Modify fields (firstName, lastName, phone, bio)
4. Click Save
5. Verify data updates

**Expected Result:**

- Profile updates successfully
- Toast shows "Profile updated successfully"
- Page refreshes with new data
- Database record is updated

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 3. Upload Avatar

**URL:** `POST http://localhost:3000/api/admin/profile/avatar`

**Test Steps:**

1. Go to Profile page
2. Click camera/edit icon on avatar
3. Select image file (jpg, png, gif, webp)
4. Wait for upload
5. Verify avatar updates

**Test Cases:**

- [ ] Upload JPG image
- [ ] Upload PNG image
- [ ] Upload GIF image
- [ ] Try to upload PDF (should fail)
- [ ] Try to upload file > 5MB (should fail)

**Expected Result:**

- Avatar uploads successfully
- Old avatar is deleted
- New avatar displays immediately
- Toast shows success message

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 4. Change Password

**URL:** `POST http://localhost:3000/api/admin/profile/change-password`

**Test Steps:**

1. Go to Profile page (or Settings page)
2. Find Change Password section
3. Enter current password
4. Enter new password (min 8 chars)
5. Click Change Password
6. Verify password changes

**Test Cases:**

- [ ] Valid password change
- [ ] Wrong current password (should fail)
- [ ] New password too short (should fail)
- [ ] Passwords match validation

**Expected Result:**

- Password changes successfully
- Can login with new password
- Toast shows success
- Audit log records change

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 5. Get Account Stats

**URL:** `GET http://localhost:3000/api/admin/profile/stats`

**Test Steps:**

1. Go to Profile page
2. Check Account Statistics section
3. Verify numbers display

**Expected Result:**

- Total actions count shows
- Active sessions shows (default: 1)
- Last login date shows
- All stats are accurate

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 6. Get Activity Log

**URL:** `GET http://localhost:3000/api/admin/profile/activity?limit=10`

**Test Steps:**

1. Go to Profile page
2. Scroll to Recent Activity section
3. Verify activity list displays

**Expected Result:**

- Recent activities show (up to 10)
- Each activity has timestamp
- Actions are descriptive
- Most recent activities first

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

## Settings Endpoints Testing

### ✅ 1. Get Settings

**URL:** `GET http://localhost:3000/api/admin/settings`

**Test Steps:**

1. Navigate to Settings page
2. Verify all sections load
3. Check default values

**Expected Result:**

- All settings sections display
- Default values are shown
- No console errors

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 2. Update Notification Settings

**URL:** `PUT http://localhost:3000/api/admin/settings/notifications`

**Test Steps:**

1. Go to Settings page
2. Go to Notifications section
3. Toggle notification switches
4. Click Save
5. Verify changes persist

**Test Cases:**

- [ ] Toggle email notifications
- [ ] Toggle push notifications
- [ ] Toggle SMS notifications
- [ ] Toggle reports notifications
- [ ] Toggle alerts
- [ ] Toggle updates
- [ ] Toggle newsletter

**Expected Result:**

- Settings save successfully
- Toast shows success
- Changes persist on page reload

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 3. Update Privacy Settings

**URL:** `PUT http://localhost:3000/api/admin/settings/privacy`

**Test Steps:**

1. Go to Settings page
2. Go to Privacy section
3. Change profile visibility
4. Toggle privacy switches
5. Click Save

**Test Cases:**

- [ ] Change profile visibility (public/team/private)
- [ ] Toggle show email
- [ ] Toggle show activity
- [ ] Toggle allow messages

**Expected Result:**

- Privacy settings update
- Toast shows success
- Changes persist

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 4. Update Security Settings

**URL:** `PUT http://localhost:3000/api/admin/settings/security`

**Test Steps:**

1. Go to Settings page
2. Go to Security section
3. Toggle login alerts
4. Change session timeout
5. Click Save

**Expected Result:**

- Security settings save
- Toast shows success
- Changes take effect

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 5. Toggle 2FA

**URL:** `POST http://localhost:3000/api/admin/settings/2fa`

**Test Steps:**

1. Go to Settings page
2. Go to Security section
3. Click Enable 2FA toggle
4. Verify 2FA is enabled
5. Click Disable 2FA
6. Verify 2FA is disabled

**Expected Result:**

- 2FA toggles successfully
- Secret key is generated (when enabling)
- Toast shows success
- Database field updates

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 6. Change Password (Settings)

**URL:** `POST http://localhost:3000/api/admin/settings/change-password`

**Test Steps:**

1. Go to Settings page
2. Go to Security section
3. Enter current password
4. Enter new password
5. Confirm new password
6. Click Change Password

**Test Cases:**

- [ ] Valid password change
- [ ] Wrong current password
- [ ] Passwords don't match
- [ ] Password too short

**Expected Result:**

- Password changes successfully
- Can login with new password
- Toast shows success

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 7. Export Data

**URL:** `GET http://localhost:3000/api/admin/settings/export-data`

**Test Steps:**

1. Go to Settings page
2. Go to Data Management section
3. Click Export Data button
4. Wait for download
5. Verify JSON file downloads

**Expected Result:**

- JSON file downloads
- Contains profile data
- Contains settings data
- Contains activity history
- File is valid JSON format

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 8. Delete Account

**URL:** `POST http://localhost:3000/api/admin/settings/delete-account`

**Test Steps:**

1. Go to Settings page
2. Go to Data Management section
3. Click Delete Account button
4. Enter password in confirmation dialog
5. Confirm deletion

**Test Cases:**

- [ ] Valid password (account soft deletes)
- [ ] Wrong password (should fail)
- [ ] Super admin account (should fail)

**Expected Result:**

- Account is deactivated (isActive = false)
- User is logged out
- Cannot login with old credentials
- Data is preserved (soft delete)

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

**⚠️ WARNING:** Test with non-super-admin account only!

---

### ✅ 9. Get Active Sessions

**URL:** `GET http://localhost:3000/api/admin/settings/sessions`

**Test Steps:**

1. Go to Settings page
2. Find Active Sessions section
3. Verify current session shows
4. Check session details

**Expected Result:**

- At least one session shows (current)
- Session shows device info
- Session shows IP address
- Current session is marked

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 10. Revoke Session

**URL:** `DELETE http://localhost:3000/api/admin/settings/sessions/:sessionId`

**Test Steps:**

1. Login from multiple devices/browsers
2. Go to Settings page
3. View active sessions
4. Click Revoke on non-current session
5. Verify session is removed

**Test Cases:**

- [ ] Revoke old session (should work)
- [ ] Try to revoke current session (should fail)

**Expected Result:**

- Session is revoked
- Session removed from list
- Other device is logged out (if implemented)
- Toast shows success

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

## Integration Testing

### ✅ 1. Profile + Settings Flow

1. Login to dashboard
2. Go to Profile page
3. Update profile information
4. Upload avatar
5. Go to Settings page
6. Change notification settings
7. Change privacy settings
8. Go back to Profile page
9. Verify all changes persisted

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 2. Password Change Flow

1. Login to dashboard
2. Go to Profile page
3. Change password
4. Logout
5. Login with new password
6. Verify login successful

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 3. Data Export + Import Verification

1. Go to Settings page
2. Export data
3. Open JSON file
4. Verify all data is present:
   - Profile information
   - Settings
   - Activity history
5. Check JSON structure is valid

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

## Error Handling Testing

### ✅ 1. Unauthorized Access

**Test:** Access endpoints without JWT token

**Expected:** 401 Unauthorized error

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 2. Invalid File Upload

**Test:** Upload non-image file or oversized file

**Expected:** 400 Bad Request with validation error

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 3. Wrong Password

**Test:** Change password with wrong current password

**Expected:** 401 Unauthorized with "Current password is incorrect"

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 4. Network Error Handling

**Test:**

1. Stop backend server
2. Try to update profile
3. Check error handling

**Expected:** Frontend shows error toast, doesn't crash

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

## Performance Testing

### ✅ 1. Large File Upload

**Test:** Upload 4.5MB image (near 5MB limit)

**Expected:** Uploads successfully without timeout

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 2. Rapid Updates

**Test:** Update profile settings multiple times quickly

**Expected:** All updates process correctly, no race conditions

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 3. Activity Log Performance

**Test:** Request activity log with large limit (100+)

**Expected:** Responds within reasonable time (<2 seconds)

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

## Security Testing

### ✅ 1. JWT Token Validation

**Test:** Use expired or invalid JWT token

**Expected:** 401 Unauthorized

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 2. Password Strength

**Test:** Try to set weak password (< 8 chars)

**Expected:** 400 Bad Request with validation error

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 3. Super Admin Protection

**Test:** Try to delete super admin account

**Expected:** 403 Forbidden

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

### ✅ 4. Audit Logging

**Test:** Perform various actions and check audit logs

**Expected:** All actions are logged with:

- Action type
- Resource
- Timestamp
- IP address
- User agent

**Status:** ⬜ Pending | ✅ Pass | ❌ Fail

---

## Browser Compatibility

Test all features in:

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Mobile Responsiveness

Test all features on:

- [ ] iPhone (iOS)
- [ ] Android phone
- [ ] Tablet

---

## Testing Summary

**Total Test Cases:** 50+
**Passed:** **_
**Failed:** _**
**Pending:** \_\_\_

---

## Common Issues & Solutions

### Issue 1: Avatar not uploading

**Solution:** Check Cloudinary credentials or use local storage fallback

### Issue 2: Settings not persisting

**Solution:** Check adminUser.metadata field in database

### Issue 3: 401 Unauthorized errors

**Solution:** Verify JWT token is being sent in Authorization header

### Issue 4: File upload 413 error

**Solution:** Check nginx/server file upload size limits

### Issue 5: CORS errors

**Solution:** Verify backend CORS configuration allows frontend origin

---

## Testing Tools

### Recommended Tools:

1. **Browser DevTools** - Network tab for API calls
2. **Postman** - API endpoint testing
3. **MongoDB Compass** - Database verification
4. **React DevTools** - Frontend state inspection

### Useful Commands:

```bash
# View backend logs
cd eagle-backend2025
npm run dev

# View frontend logs
cd eagle-dashboard2025
npm run dev

# Check MongoDB data
mongo
use your_database
db.adminusers.find().pretty()
db.auditlogs.find().pretty()
```

---

## Sign-off

**Tester Name:** ********\_\_\_********
**Date:** ********\_\_\_********
**Environment:** Development / Staging / Production
**Overall Status:** Pass / Fail / Pending

**Notes:**

---

---

---
