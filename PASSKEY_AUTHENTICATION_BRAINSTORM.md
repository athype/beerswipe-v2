# Passkey Authentication Implementation Brainstorm

## Overview
Passkeys (WebAuthn) provide passwordless authentication using public-key cryptography. Users authenticate with biometrics (fingerprint, Face ID), device PIN, or security keys instead of passwords.

---

## 🎯 Implementation Approach

### Option 1: Passkey-Only Authentication (Replacement)
Replace password authentication entirely with passkeys.

**Flow:**
1. Admin registers their passkey during account creation
2. Login uses only passkey authentication
3. Remove password fields from UI/database

### Option 2: Hybrid Authentication (Recommended)
Keep passwords as fallback, add passkeys as optional enhancement.

**Flow:**
1. Admin can log in with password (existing)
2. Admin can optionally register passkeys in dashboard
3. Login page offers both password and passkey options
4. Multiple passkeys per admin (different devices)

### Option 3: Progressive Enhancement
Start with password, encourage passkey enrollment after login.

**Flow:**
1. Initial login with password
2. Prompt user to register passkey after first login
3. Future logins prefer passkey, fallback to password
4. Eventually phase out passwords

---

## 🗄️ Database Schema Changes

### New Table: `Passkeys` (Recommended for Hybrid/Multiple)
```sql
CREATE TABLE "Passkeys" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "credentialId" TEXT NOT NULL UNIQUE,  -- Base64 encoded credential ID
  "publicKey" TEXT NOT NULL,             -- Base64 encoded public key
  "counter" BIGINT NOT NULL DEFAULT 0,   -- Signature counter for replay protection
  "transports" TEXT[],                   -- ['usb', 'nfc', 'ble', 'internal']
  "deviceName" VARCHAR(100),             -- User-friendly name (e.g., "iPhone 13")
  "createdAt" TIMESTAMP NOT NULL,
  "lastUsedAt" TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_credentialId (credentialId)
);
```

### Alternative: Modify `Users` Table (Single Passkey Only)
```sql
ALTER TABLE "Users" ADD COLUMN "passkeyCredentialId" TEXT UNIQUE;
ALTER TABLE "Users" ADD COLUMN "passkeyPublicKey" TEXT;
ALTER TABLE "Users" ADD COLUMN "passkeyCounter" BIGINT DEFAULT 0;
ALTER TABLE "Users" ADD COLUMN "passkeyTransports" TEXT[];
```

### Migration Strategy
```javascript
// Sequelize migration
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Passkeys', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      credentialId: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true
      },
      publicKey: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      counter: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      transports: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      deviceName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('Passkeys', ['userId']);
    await queryInterface.addIndex('Passkeys', ['credentialId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Passkeys');
  }
};
```

---

## 🔧 Backend Modifications Required

### 1. New Dependencies
```json
{
  "@simplewebauthn/server": "^9.0.0",  // WebAuthn server library
  "@simplewebauthn/typescript-types": "^9.0.0"
}
```

### 2. New Model: `backend/src/models/Passkey.js`
```javascript
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Passkey = sequelize.define("Passkey", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Users",
      key: "id"
    }
  },
  credentialId: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  publicKey: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  counter: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  transports: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  deviceName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Passkey;
```

### 3. Update Model Relationships: `backend/src/models/index.js`
```javascript
// Add associations
User.hasMany(Passkey, { foreignKey: 'userId', onDelete: 'CASCADE' });
Passkey.belongsTo(User, { foreignKey: 'userId' });
```

### 4. New API Endpoints: `backend/src/api/passkeys.js`

**Registration Flow:**
- `POST /api/v1/passkeys/register-options` - Generate registration challenge
- `POST /api/v1/passkeys/register-verify` - Verify and store passkey

**Authentication Flow:**
- `POST /api/v1/passkeys/login-options` - Generate authentication challenge
- `POST /api/v1/passkeys/login-verify` - Verify passkey and issue token

**Management:**
- `GET /api/v1/passkeys` - List user's passkeys
- `DELETE /api/v1/passkeys/:id` - Remove a passkey
- `PUT /api/v1/passkeys/:id` - Update device name

### 5. Environment Variables
```env
# Passkey configuration
RP_NAME="Beer Machine Admin"
RP_ID="beer.sv-ada.nl"  # Your domain without protocol
ORIGIN="https://beer.sv-ada.nl"
```

### 6. WebAuthn Helper: `backend/src/utils/webauthn.js`
```javascript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

export const rpName = process.env.RP_NAME || 'Beer Machine';
export const rpID = process.env.RP_ID || 'localhost';
export const origin = process.env.ORIGIN || 'http://localhost:5173';

// Store challenges temporarily (use Redis in production)
const challengeStore = new Map();

export function storeChallenge(userId, challenge) {
  challengeStore.set(userId, { challenge, timestamp: Date.now() });
  // Clean up after 5 minutes
  setTimeout(() => challengeStore.delete(userId), 5 * 60 * 1000);
}

export function getChallenge(userId) {
  const data = challengeStore.get(userId);
  if (!data) return null;
  
  // Challenge expires after 5 minutes
  if (Date.now() - data.timestamp > 5 * 60 * 1000) {
    challengeStore.delete(userId);
    return null;
  }
  
  return data.challenge;
}

export function clearChallenge(userId) {
  challengeStore.delete(userId);
}
```

---

## 🎨 Frontend Modifications Required

### 1. New Dependencies
```json
{
  "@simplewebauthn/browser": "^9.0.0"  // WebAuthn browser library
}
```

### 2. New Store: `frontend/src/stores/passkey.js`
```javascript
import { defineStore } from 'pinia'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import api from '../services/api'

export const usePasskeyStore = defineStore('passkey', {
  state: () => ({
    passkeys: [],
    loading: false,
    error: null,
    isSupported: false
  }),
  
  actions: {
    async checkSupport() {
      this.isSupported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      return this.isSupported
    },
    
    async registerPasskey(deviceName) {
      // Registration flow
    },
    
    async authenticateWithPasskey() {
      // Authentication flow
    },
    
    async fetchPasskeys() {
      // List passkeys
    },
    
    async deletePasskey(id) {
      // Remove passkey
    }
  }
})
```

### 3. New Components

**`frontend/src/components/PasskeyRegistration.vue`**
- Form to register new passkey with device name
- Browser compatibility check
- Visual feedback during registration

**`frontend/src/components/PasskeyList.vue`**
- Display registered passkeys with device names
- Last used timestamp
- Delete button for each passkey

**`frontend/src/components/PasskeyLogin.vue`**
- Passkey login button on login page
- Automatic authentication trigger
- Fallback to password option

### 4. Update Views

**`LoginView.vue`** - Add passkey login option:
```vue
<div class="login-options">
  <button @click="loginWithPasskey" class="btn btn-passkey">
    🔐 Login with Passkey
  </button>
  <div class="divider">OR</div>
  <!-- Existing password form -->
</div>
```

**`AdminDashboardView.vue`** - Add passkey management tab:
```vue
<div v-if="activeTab === 'security'" class="tab-content">
  <h2>Security Settings</h2>
  <PasskeyList :passkeys="passkeyStore.passkeys" />
  <PasskeyRegistration @registered="handlePasskeyRegistered" />
</div>
```

---

## ✅ Pros of Passkey Authentication

### Security Benefits
1. **Phishing-Resistant**: Passkeys are domain-bound, can't be used on fake sites
2. **No Password Leaks**: No passwords to steal, dump, or brute force
3. **Strong Cryptography**: Uses public-key cryptography (ECDSA/RSA)
4. **Replay Protection**: Counter mechanism prevents replay attacks
5. **Device-Bound**: Private keys never leave the device
6. **No Credential Stuffing**: Each account has unique keypair

### User Experience Benefits
1. **Faster Login**: Touch/Face ID is quicker than typing passwords
2. **No Password Management**: Don't need to remember/store passwords
3. **Multi-Device**: Sync via iCloud Keychain, Google Password Manager
4. **No Password Reset**: No "forgot password" flow needed
5. **Modern UX**: Feels native and integrated with OS

### Operational Benefits
1. **Reduced Support**: No password reset requests
2. **Compliance**: Meets modern authentication standards (FIDO2)
3. **Future-Proof**: Industry standard, growing adoption
4. **Cross-Platform**: Works on iOS, Android, Windows, macOS

---

## ❌ Cons of Passkey Authentication

### Implementation Challenges
1. **Complexity**: More complex than password authentication
2. **Learning Curve**: Developers need WebAuthn knowledge
3. **Testing**: Harder to test, requires physical devices/emulators
4. **Debugging**: Cryptographic operations harder to debug
5. **Migration**: Existing users need migration path

### User Experience Challenges
1. **Browser Support**: Not all browsers support WebAuthn fully
   - Chrome/Edge: ✅ Full support
   - Firefox: ✅ Full support
   - Safari: ✅ iOS 16+, macOS 13+
   - Opera: ✅ Chromium-based
2. **Device Requirements**: Need biometric device or security key
3. **User Understanding**: Some users unfamiliar with passkeys
4. **Backup Concerns**: Users worry about losing access
5. **Multi-Device Setup**: Requires setup on each device

### Operational Challenges
1. **Fallback Needed**: Must keep password option for recovery
2. **Support Complexity**: Support staff needs training
3. **Testing Environment**: Localhost vs production URL differences
4. **Database Migration**: Requires schema changes
5. **Session Management**: Need to handle multiple auth methods

### Technical Limitations
1. **HTTPS Required**: Won't work on HTTP (except localhost)
2. **Domain-Specific**: Passkeys tied to specific domain
3. **No Shared Devices**: Not ideal for shared computers
4. **Challenge Storage**: Need session/cache for challenges
5. **Counter Management**: Must track signature counters

---

## 🚀 Recommended Implementation Strategy

### Phase 1: Foundation (Week 1)
1. Add Passkeys table to database
2. Install WebAuthn dependencies
3. Create Passkey model and associations
4. Set up environment variables
5. Write database migrations

### Phase 2: Backend API (Week 1-2)
1. Create WebAuthn helper utilities
2. Implement registration endpoints
3. Implement authentication endpoints
4. Add passkey management endpoints (list, delete, rename)
5. Add proper error handling and validation

### Phase 3: Frontend Integration (Week 2)
1. Install browser WebAuthn library
2. Create passkey store
3. Add passkey login to LoginView
4. Create PasskeyList component
5. Create PasskeyRegistration component

### Phase 4: Admin Dashboard (Week 2-3)
1. Add "Security" tab to admin dashboard
2. Display registered passkeys
3. Allow passkey registration
4. Allow passkey deletion/renaming
5. Show last used timestamps

### Phase 5: Polish & Testing (Week 3)
1. Add browser compatibility checks
2. Implement graceful fallbacks
3. Test on multiple devices/browsers
4. Add loading states and error messages
5. Write user documentation

### Phase 6: Optional Enhancements
1. Conditional UI based on browser support
2. Passkey sync status indicators
3. Push notifications for new passkey registrations
4. Admin audit log for passkey operations
5. Progressive enrollment prompts

---

## 🎯 Decision Matrix

| Criterion | Password Only | Hybrid (Recommended) | Passkey Only |
|-----------|---------------|----------------------|---------------|
| Security | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| User Experience | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Implementation Complexity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Compatibility | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Maintenance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Recovery Options | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Future-Proof | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Recommendation**: **Hybrid Approach** provides best balance of security, UX, and practicality.

---

## 📊 User Flow Diagrams

### Registration Flow
```
Admin Dashboard → Security Tab → Click "Add Passkey"
    ↓
Enter device name (e.g., "MacBook Pro")
    ↓
Click "Register Passkey"
    ↓
Backend generates challenge
    ↓
Browser shows Touch ID / Face ID prompt
    ↓
User authenticates with biometric
    ↓
Browser creates keypair and credential
    ↓
Frontend sends credential to backend
    ↓
Backend verifies and stores passkey
    ↓
Success! Passkey appears in list
```

### Login Flow
```
Login Page → Click "Login with Passkey"
    ↓
Backend generates challenge (username optional)
    ↓
Browser shows available passkeys
    ↓
User selects account and authenticates
    ↓
Frontend sends assertion to backend
    ↓
Backend verifies signature and counter
    ↓
Backend issues JWT token
    ↓
Redirect to dashboard
```

### Fallback Flow
```
Passkey login fails or unavailable
    ↓
Show "Use Password Instead" button
    ↓
Display password login form
    ↓
Traditional username/password login
```

---

## 🔒 Security Considerations

### Challenge Management
- **Problem**: Challenges must be unique per registration/authentication
- **Solution**: Store challenges in Redis with TTL (5 minutes)
- **Fallback**: In-memory Map with setTimeout cleanup

### Counter Verification
- **Problem**: Signature counter must always increase (prevents cloning)
- **Solution**: Store counter in database, verify on each authentication
- **Action**: Reject if counter doesn't increase

### Origin Validation
- **Problem**: Credentials only work on registered domain
- **Solution**: Set RP_ID and ORIGIN correctly in production
- **Note**: localhost exception only in development

### Private Key Security
- **Storage**: Private keys NEVER sent to server
- **Location**: Stored in device secure enclave/TPM
- **Backup**: Synced via platform (iCloud/Google) if enabled

### Session Management
- **Tokens**: Still use JWT for session management
- **Expiry**: Same token expiry rules apply
- **Refresh**: Consider refresh tokens for passkey-authenticated sessions

---

## 📚 Resources & Libraries

### Backend Libraries
- [@simplewebauthn/server](https://github.com/MasterKale/SimpleWebAuthn) - WebAuthn server library
- [fido2-lib](https://github.com/webauthn-open-source/fido2-lib) - Alternative FIDO2 library

### Frontend Libraries
- [@simplewebauthn/browser](https://github.com/MasterKale/SimpleWebAuthn) - WebAuthn browser library
- [@github/webauthn-json](https://github.com/github/webauthn-json) - GitHub's WebAuthn wrapper

### Documentation
- [WebAuthn Guide](https://webauthn.guide/) - Interactive guide
- [MDN WebAuthn API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API) - Official docs
- [FIDO Alliance](https://fidoalliance.org/) - Standards organization
- [passkeys.dev](https://passkeys.dev/) - Industry resource site

### Testing Tools
- [WebAuthn.io](https://webauthn.io/) - Test implementation
- [webauthn.me](https://webauthn.me/) - Another test site
- Chrome DevTools - Virtual authenticator

---

## 💡 Next Steps

If you decide to proceed, I recommend:

1. **Start with database schema** - Create Passkeys table migration
2. **Backend first** - Implement registration/authentication endpoints
3. **Frontend integration** - Add to admin dashboard (not login initially)
4. **Test thoroughly** - Multiple devices and browsers
5. **Gradual rollout** - Optional feature first, encourage adoption
6. **Monitor usage** - Track adoption rates and issues
7. **Iterate** - Gather feedback and improve UX

Would you like me to start implementing any specific part of this? I'd recommend starting with the database migration and Passkey model as the foundation.
