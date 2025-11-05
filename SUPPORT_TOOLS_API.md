# Eagle Support Tools API Documentation

## Overview
Comprehensive Support Tools system for Eagle Investors platform providing user impersonation, email resend services, user notes & flags, and saved replies library.

**Base URL:** `/api/support`
**Authentication:** Required (Admin role)
**Version:** 1.0.0

---

## 🔧 User Impersonation System

### Features
- **Read-only by default** with explicit write confirmation
- **Full audit logging** of all actions
- **Session-based** with automatic expiration
- **Security controls** with admin approval for write actions

### Endpoints

#### Start Impersonation Session
```http
POST /api/support/impersonation/start
```

**Request Body:**
```json
{
  "targetUserId": "60d5ec49e8b4c72f8c8b4567",
  "reason": "User reporting payment issues, need to investigate account",
  "sessionType": "READ_ONLY"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Impersonation session started successfully",
  "data": {
    "sessionId": "60d5ec49e8b4c72f8c8b4568",
    "targetUser": {
      "id": "60d5ec49e8b4c72f8c8b4567",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "sessionType": "READ_ONLY",
    "startTime": "2025-11-05T10:30:00.000Z",
    "expiresAt": "2025-11-05T12:30:00.000Z",
    "banner": {
      "message": "🔧 SUPPORT MODE: Now viewing as John Doe (john@example.com)",
      "type": "info",
      "dismissible": false
    }
  }
}
```

#### Get Active Sessions
```http
GET /api/support/impersonation/sessions?page=1&limit=20
```

#### End Session
```http
POST /api/support/impersonation/sessions/{sessionId}/end
```

### UI Implementation Guide

#### Impersonation Banner Component
```jsx
const ImpersonationBanner = ({ impersonationData }) => {
  if (!impersonationData?.active) return null;
  
  return (
    <div className="impersonation-banner bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
          <span className="text-yellow-800 font-medium">
            {impersonationData.banner.message}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-yellow-600">
            Expires: {formatTime(impersonationData.expiresAt)}
          </span>
          <button 
            onClick={endSession}
            className="text-yellow-800 hover:text-yellow-900"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### Start Impersonation Modal
```jsx
const StartImpersonationModal = ({ isOpen, onClose, onStart }) => {
  const [formData, setFormData] = useState({
    targetUserId: '',
    reason: '',
    sessionType: 'READ_ONLY'
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-medium mb-4">Start User Impersonation</h3>
        
        <UserSearch 
          onSelect={(user) => setFormData({...formData, targetUserId: user.id})}
          placeholder="Search for user to impersonate..."
        />
        
        <textarea
          value={formData.reason}
          onChange={(e) => setFormData({...formData, reason: e.target.value})}
          placeholder="Reason for impersonation (required)"
          className="w-full mt-4 p-2 border rounded"
          rows={3}
          required
        />
        
        <select
          value={formData.sessionType}
          onChange={(e) => setFormData({...formData, sessionType: e.target.value})}
          className="w-full mt-2 p-2 border rounded"
        >
          <option value="READ_ONLY">Read Only</option>
          <option value="WRITE_ENABLED">Write Enabled (Requires Approval)</option>
        </select>
        
        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">
            Cancel
          </button>
          <button 
            onClick={() => onStart(formData)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Start Impersonation
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

---

## 📧 Email Resend Services

### Features
- **Rate limiting** per email type
- **Audit logging** of all resend operations
- **Bulk resend** for multiple users
- **History tracking** with failure reasons

### Endpoints

#### Resend Verification Email
```http
POST /api/support/email-resend/verification/{userId}
```

**Request Body:**
```json
{
  "reason": "User reports not receiving verification email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent successfully",
  "data": {
    "resendId": "60d5ec49e8b4c72f8c8b4569",
    "rateLimit": {
      "allowed": true,
      "dailyCount": 1,
      "hourlyCount": 1,
      "dailyLimit": 3,
      "hourlyLimit": 1
    }
  }
}
```

#### Get Available Email Types
```http
GET /api/support/email-resend/types
```

#### Check Rate Limits
```http
GET /api/support/email-resend/rate-limits/{userId}
```

### UI Implementation Guide

#### Email Resend Panel
```jsx
const EmailResendPanel = ({ userId }) => {
  const [emailTypes, setEmailTypes] = useState([]);
  const [rateLimits, setRateLimits] = useState({});
  const [selectedType, setSelectedType] = useState('');

  const handleResend = async (type, formData) => {
    const endpoint = getResendEndpoint(type, userId);
    const response = await api.post(endpoint, formData);
    
    if (response.data.success) {
      toast.success(response.data.message);
      refreshRateLimits();
    }
  };

  return (
    <div className="email-resend-panel bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium mb-4">Email Resend Services</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {emailTypes.map(type => (
          <EmailTypeCard
            key={type.type}
            type={type}
            rateLimit={rateLimits[type.type]}
            onResend={handleResend}
            userId={userId}
          />
        ))}
      </div>
    </div>
  );
};

const EmailTypeCard = ({ type, rateLimit, onResend, userId }) => {
  const [showModal, setShowModal] = useState(false);
  const isLimited = !rateLimit?.allowed;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium">{type.name}</h4>
        <span className={`text-xs px-2 py-1 rounded ${
          isLimited ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}>
          {rateLimit ? `${rateLimit.dailyCount}/${rateLimit.dailyLimit}` : 'Loading...'}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">{type.description}</p>
      
      <button
        onClick={() => setShowModal(true)}
        disabled={isLimited}
        className={`w-full py-2 px-4 rounded text-sm ${
          isLimited 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isLimited ? 'Rate Limited' : 'Resend'}
      </button>
      
      <ResendModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        type={type}
        userId={userId}
        onSubmit={onResend}
      />
    </div>
  );
};
```

---

## 📝 User Notes & Flags System

### Features
- **PII minimization** with visibility controls
- **Categorized notes** (Support, Finance, Technical, etc.)
- **Flag system** for account status (VIP, Problematic, etc.)
- **Search functionality** across all notes

### Endpoints

#### Create Note
```http
POST /api/support/notes/{userId}
```

**Request Body:**
```json
{
  "title": "Payment Issue Investigation",
  "content": "User experiencing recurring payment failures. Stripe logs show declined transactions.",
  "noteType": "BILLING",
  "priority": "HIGH",
  "tags": ["payment", "stripe", "investigation"],
  "visibility": "FINANCE",
  "isPinned": true
}
```

#### Add Flag
```http
POST /api/support/notes/{userId}/flags
```

**Request Body:**
```json
{
  "flagType": "PAYMENT_ISSUES",
  "reason": "Multiple failed payment attempts",
  "expiresAt": "2025-12-05T00:00:00.000Z"
}
```

### UI Implementation Guide

#### User Notes Dashboard
```jsx
const UserNotesDashboard = ({ userId }) => {
  const [notes, setNotes] = useState([]);
  const [flags, setFlags] = useState([]);
  const [activeTab, setActiveTab] = useState('notes');

  return (
    <div className="user-notes-dashboard">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">User Notes & Flags</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowNoteModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Add Note
          </button>
          <button
            onClick={() => setShowFlagModal(true)}
            className="px-4 py-2 bg-yellow-600 text-white rounded"
          >
            Add Flag
          </button>
        </div>
      </div>

      <div className="flex space-x-1 mb-4">
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 rounded-t ${
            activeTab === 'notes' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          Notes ({notes.length})
        </button>
        <button
          onClick={() => setActiveTab('flags')}
          className={`px-4 py-2 rounded-t ${
            activeTab === 'flags' ? 'bg-yellow-500 text-white' : 'bg-gray-200'
          }`}
        >
          Flags ({flags.length})
        </button>
      </div>

      {activeTab === 'notes' && <NotesTab notes={notes} />}
      {activeTab === 'flags' && <FlagsTab flags={flags} />}
    </div>
  );
};

const NoteCard = ({ note, onUpdate, onDelete }) => (
  <div className="note-card border rounded-lg p-4 mb-4">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center space-x-2">
        <h4 className="font-medium">{note.title}</h4>
        {note.isPinned && <PinIcon className="h-4 w-4 text-yellow-500" />}
        <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(note.priority)}`}>
          {note.priority}
        </span>
      </div>
      <span className="text-xs text-gray-500">
        {formatDate(note.createdAt)}
      </span>
    </div>
    
    <p className="text-gray-700 mb-3">{note.content}</p>
    
    <div className="flex justify-between items-center">
      <div className="flex space-x-1">
        {note.tags.map(tag => (
          <span key={tag} className="px-2 py-1 text-xs bg-gray-100 rounded">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex space-x-2">
        <button onClick={() => onUpdate(note)} className="text-blue-600 text-sm">
          Edit
        </button>
        <button onClick={() => onDelete(note)} className="text-red-600 text-sm">
          Delete
        </button>
      </div>
    </div>
  </div>
);
```

---

## 💬 Saved Replies Library

### Features
- **Template system** with variable substitution
- **Category organization** (Support, Finance, Technical)
- **Version control** with change tracking
- **Usage statistics** and popularity ranking

### Endpoints

#### Create Saved Reply
```http
POST /api/support/saved-replies
```

**Request Body:**
```json
{
  "title": "Payment Receipt Request",
  "category": "FINANCE",
  "subcategory": "Receipt Query",
  "subject": "Your Payment Receipt - Eagle Investors",
  "content": "Dear {{customerName}},\n\nThank you for your inquiry. Please find your payment receipt for transaction {{transactionId}} attached to this email.\n\nTransaction Details:\n- Amount: {{amount}}\n- Date: {{paymentDate}}\n- Method: {{paymentMethod}}\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nEagle Investors Support Team",
  "variables": [
    {
      "name": "customerName",
      "description": "Customer's full name",
      "isRequired": true
    },
    {
      "name": "transactionId",
      "description": "Transaction ID from payment system",
      "isRequired": true
    },
    {
      "name": "amount",
      "description": "Payment amount",
      "isRequired": true
    },
    {
      "name": "paymentDate",
      "description": "Date of payment",
      "isRequired": true
    },
    {
      "name": "paymentMethod",
      "description": "Payment method used",
      "defaultValue": "Credit Card"
    }
  ],
  "tags": ["payment", "receipt", "finance"],
  "isPublic": true
}
```

#### Use Saved Reply
```http
POST /api/support/saved-replies/{replyId}/use
```

**Request Body:**
```json
{
  "variables": {
    "customerName": "John Doe",
    "transactionId": "TXN123456",
    "amount": "$99.00",
    "paymentDate": "November 5, 2025",
    "paymentMethod": "Visa ending in 1234"
  }
}
```

### UI Implementation Guide

#### Saved Replies Manager
```jsx
const SavedRepliesManager = () => {
  const [replies, setReplies] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="saved-replies-manager">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Saved Replies Library</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Create New Reply
        </button>
      </div>

      <div className="filters-bar flex space-x-4 mb-6">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="ALL">All Categories</option>
          <option value="SUPPORT">Support</option>
          <option value="FINANCE">Finance</option>
          <option value="TECHNICAL">Technical</option>
        </select>
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search replies..."
          className="flex-1 border rounded px-3 py-2"
        />
      </div>

      <div className="replies-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {replies.map(reply => (
          <ReplyCard
            key={reply._id}
            reply={reply}
            onUse={handleUseReply}
            onEdit={handleEditReply}
          />
        ))}
      </div>
    </div>
  );
};

const ReplyCard = ({ reply, onUse, onEdit }) => (
  <div className="reply-card border rounded-lg p-4">
    <div className="flex justify-between items-start mb-2">
      <h4 className="font-medium">{reply.title}</h4>
      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
        {reply.category}
      </span>
    </div>
    
    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
      {reply.content.substring(0, 100)}...
    </p>
    
    <div className="flex justify-between items-center">
      <div className="flex space-x-1">
        {reply.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={() => onUse(reply)}
          className="text-blue-600 text-sm hover:underline"
        >
          Use
        </button>
        <button
          onClick={() => onEdit(reply)}
          className="text-gray-600 text-sm hover:underline"
        >
          Edit
        </button>
      </div>
    </div>
    
    <div className="mt-2 text-xs text-gray-500">
      Used {reply.usageCount} times
    </div>
  </div>
);

const UseReplyModal = ({ reply, isOpen, onClose, onSubmit }) => {
  const [variables, setVariables] = useState({});

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6">
        <h3 className="text-lg font-medium mb-4">Use Reply: {reply.title}</h3>
        
        <div className="space-y-4 mb-6">
          {reply.variables.map(variable => (
            <div key={variable.name}>
              <label className="block text-sm font-medium mb-1">
                {variable.name} {variable.isRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={variables[variable.name] || ''}
                onChange={(e) => setVariables({
                  ...variables,
                  [variable.name]: e.target.value
                })}
                placeholder={variable.description}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          ))}
        </div>
        
        <div className="preview-section bg-gray-50 p-4 rounded mb-4">
          <h4 className="text-sm font-medium mb-2">Preview:</h4>
          <div className="whitespace-pre-wrap text-sm">
            {renderTemplate(reply.content, variables)}
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reply, variables)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Generate Reply
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

---

## 🔒 Security Features

### Authentication & Authorization
- **JWT-based authentication** required for all endpoints
- **Admin role required** for all support tools
- **Session-based impersonation** with automatic expiration
- **Write action approval** workflow for impersonation

### Audit Logging
- **Complete audit trail** for all support actions
- **IP address and user agent** tracking
- **Session correlation** for impersonation activities
- **Rate limit tracking** for email resends

### Data Protection
- **PII minimization** in notes system
- **Visibility controls** based on user roles
- **Soft deletion** with audit trail
- **Automatic session cleanup** for expired sessions

---

## 📊 Analytics & Monitoring

### Available Metrics
- **Impersonation session statistics**
- **Email resend rate limits and usage**
- **Note creation and flag usage patterns**
- **Saved reply popularity and usage**

### Health Checks
```http
GET /api/support/
```

Returns system status and available features.

---

## 🚀 Deployment Notes

### Environment Variables
```env
# Email Service Configuration
EMAIL_USER=your_email@domain.com
EMAIL_PASS=your_email_password

# Rate Limiting
SUPPORT_EMAIL_DAILY_LIMIT=50
SUPPORT_EMAIL_HOURLY_LIMIT=10
```

### Database Indexes
Ensure proper indexes are created for:
- `supportSessions`: `{ supportAgent: 1, status: 1 }`
- `userNotes`: `{ userId: 1, isDeleted: 1 }`
- `emailResendLogs`: `{ recipientUserId: 1, emailType: 1 }`
- `savedReplies`: `{ category: 1, isActive: 1 }`

### Scheduled Tasks
Set up cron jobs for:
- **Session cleanup**: Every hour to expire old sessions
- **Rate limit reset**: Daily reset of email resend counters
- **Archive old logs**: Weekly archival of old audit logs

This comprehensive support tools system provides enterprise-grade functionality for customer support operations with full audit trails, security controls, and user-friendly interfaces.