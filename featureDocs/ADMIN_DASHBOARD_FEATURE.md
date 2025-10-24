# Admin Dashboard Feature

## Overview
Complete admin management system allowing admins to manage their own profile and other admin accounts.

## Backend API Endpoints

### Base URL: `/api/v1/admin`

All endpoints require authentication (`authenticateToken`) and admin role (`requireAdmin`).

#### 1. Get All Admins
- **GET** `/api/v1/admin`
- Returns list of all active admin accounts
- Response: `{ admins: [...] }`

#### 2. Get Current Profile
- **GET** `/api/v1/admin/profile`
- Returns current admin's profile information
- Response: `{ admin: {...} }`

#### 3. Update Current Profile
- **PUT** `/api/v1/admin/profile`
- Body: `{ username?, password?, currentPassword? }`
- Returns updated profile and new token if username changed
- Requires current password when changing password

#### 4. Create New Admin
- **POST** `/api/v1/admin`
- Body: `{ username, password }`
- Creates new admin account
- Password must be at least 6 characters

#### 5. Update Another Admin
- **PUT** `/api/v1/admin/:id`
- Body: `{ username?, password? }`
- Updates another admin's account
- Cannot update your own account (use /profile instead)

#### 6. Deactivate Admin
- **DELETE** `/api/v1/admin/:id`
- Soft deletes admin by setting `isActive = false`
- Cannot delete yourself
- Cannot delete last active admin

## Frontend Components

### 1. AdminDashboardView (`/admin`)
Main view with two tabs:
- **My Profile**: Manage current user's profile
- **Manage Admins**: List and manage other admin accounts

### 2. AdminForm Component
Reusable form for creating/editing admins
- Props: `admin` (object), `isProfile` (boolean)
- Features:
  - Username field
  - Password field (optional for updates)
  - Current password field (for profile updates)
  - Password confirmation
  - Validation

### 3. AdminList Component
Table displaying all admin accounts
- Shows username, creation date, last update
- Highlights current user with badge
- Edit/Delete actions for other admins

### 4. Admin Store (`stores/admin.js`)
Pinia store managing admin state:
- `admins` - List of all admins
- `currentAdmin` - Current user's profile
- Actions: fetchAdmins, fetchProfile, updateProfile, createAdmin, updateAdmin, deleteAdmin

## Features

### Profile Management
- ✅ View current profile information
- ✅ Update username (receives new JWT token)
- ✅ Change password (requires current password)
- ✅ Password validation (min 6 characters)
- ✅ Password confirmation

### Admin Management
- ✅ View all admin accounts
- ✅ Create new admin accounts
- ✅ Edit other admin accounts
- ✅ Deactivate admin accounts
- ✅ Prevent self-deletion
- ✅ Prevent deleting last admin

### Security
- ✅ All endpoints require admin authentication
- ✅ Current password required for password changes
- ✅ Cannot update own account through admin endpoint
- ✅ Username uniqueness validation
- ✅ Password strength validation
- ✅ Soft delete (isActive flag)

### UI/UX
- ✅ Glassmorphism theme throughout
- ✅ Tab-based interface
- ✅ Modal forms for create/edit
- ✅ Success/error notifications
- ✅ Responsive design
- ✅ Username clickable in navbar → goes to admin dashboard
- ✅ "You" badge for current user in admin list

## Usage

### Accessing Admin Dashboard
1. Click on your username in the navbar
2. Or navigate to `/admin`

### Managing Your Profile
1. Go to "My Profile" tab
2. Update username and/or password
3. Enter current password if changing password
4. Click "Update Admin"

### Creating New Admin
1. Go to "Manage Admins" tab
2. Click "Create New Admin"
3. Fill in username and password
4. Click "Create Admin"

### Editing Another Admin
1. Go to "Manage Admins" tab
2. Find admin in list
3. Click "Edit" button
4. Update details
5. Click "Update Admin"

### Deactivating Admin
1. Go to "Manage Admins" tab
2. Find admin in list
3. Click "Delete" button
4. Confirm action

## File Structure

```
backend/src/api/
  └── admin.js              # Admin API endpoints

frontend/src/
  ├── components/
  │   ├── AdminForm.vue     # Reusable admin form
  │   ├── AdminList.vue     # Admin table component
  │   └── NavBar.vue        # Updated with clickable username
  ├── stores/
  │   └── admin.js          # Admin state management
  ├── views/
  │   └── AdminDashboardView.vue  # Main admin view
  └── router/
      └── index.js          # Added /admin route
```

## Testing Checklist

### Backend
- [ ] GET /api/v1/admin - List all admins
- [ ] GET /api/v1/admin/profile - Get current profile
- [ ] PUT /api/v1/admin/profile - Update profile
- [ ] POST /api/v1/admin - Create admin
- [ ] PUT /api/v1/admin/:id - Update admin
- [ ] DELETE /api/v1/admin/:id - Delete admin
- [ ] Verify auth middleware working
- [ ] Verify admin role required
- [ ] Test validation errors

### Frontend
- [ ] Navigate to /admin via navbar username
- [ ] View profile tab
- [ ] Update username (verify new token)
- [ ] Update password with current password
- [ ] View admins list
- [ ] Create new admin
- [ ] Edit another admin
- [ ] Delete admin (with confirmation)
- [ ] Verify "You" badge appears
- [ ] Test responsive design
- [ ] Verify glassmorphism styling

## Notes

- Original `/auth/create-admin` endpoint still exists but restricted to development environment
- New admin creation through dashboard works in all environments
- Username changes require re-login (new JWT token issued)
- All password changes are hashed using bcrypt
- Admins cannot be fully deleted, only deactivated (soft delete)
- System prevents deletion of last active admin
