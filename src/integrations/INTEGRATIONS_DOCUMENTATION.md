# Eagle Platform - Integrations System

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Payment Integrations](#payment-integrations)
- [Communication Integrations](#communication-integrations)
- [Tax Integrations](#tax-integrations)
- [Integration Management](#integration-management)
- [API Reference](#api-reference)
- [UI Implementation Guide](#ui-implementation-guide)
- [Authentication & Security](#authentication--security)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Monitoring & Analytics](#monitoring--analytics)

---

## Overview

The Eagle Platform Integrations System provides a unified interface for managing multiple third-party service providers across payments, communications, and tax calculations. It features automatic failover, health monitoring, and comprehensive management APIs.

### Key Features
- **Multi-Provider Support**: Seamlessly switch between service providers
- **Automatic Failover**: Built-in redundancy and error recovery
- **Health Monitoring**: Real-time provider status tracking
- **Rate Limiting**: Intelligent request throttling
- **Audit Logging**: Complete operation tracking
- **Batch Operations**: Efficient bulk processing
- **Configuration Management**: Dynamic provider setup

---

## Architecture

### Directory Structure
```
src/integrations/
├── adapters/              # Payment processor adapters
│   ├── BasePaymentProcessor.js
│   ├── StripePaymentProcessor.js
│   └── BraintreePaymentProcessor.js
├── providers/             # Service provider implementations  
│   ├── BaseCommunicationProvider.js
│   ├── SendGridProvider.js
│   ├── PostmarkProvider.js
│   ├── TwilioProvider.js
│   ├── BaseTaxProvider.js
│   ├── StripeTaxProvider.js
│   ├── TaxJarProvider.js
│   └── AvalaraProvider.js
├── managers/              # Service managers
│   ├── CommunicationManager.js
│   └── TaxManager.js
├── controllers/           # HTTP controllers
│   ├── PaymentController.js
│   ├── CommunicationController.js
│   ├── TaxController.js
│   └── IntegrationController.js
├── routes/               # API routes
│   ├── index.js
│   ├── payment.routes.js
│   ├── communication.routes.js
│   ├── tax.routes.js
│   └── integrationSettings.routes.js
├── models/               # Database models
│   ├── integrationSettings.model.js
│   └── webhookLog.model.js
└── webhooks/             # Webhook handlers
    ├── stripeWebhook.js
    └── braintreeWebhook.js
```

### Base URL
All integration APIs are accessible under:
```
https://api.eagleplatform.com/api/integrations
```

---

## Payment Integrations

### Supported Providers
- **Stripe**: Global payment processing with extensive features
- **Braintree**: PayPal's payment platform with fraud protection

### API Endpoints

#### Process Payment
```http
POST /api/integrations/payment/process
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "amount": 10000,
  "currency": "USD",
  "paymentMethodId": "pm_1234567890",
  "customerId": "cus_customer123",
  "description": "Eagle Platform Subscription",
  "metadata": {
    "orderId": "ORDER-2025-001",
    "userId": "user_123"
  },
  "preferredProvider": "stripe",
  "enableFailover": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "paymentId": "pi_1234567890abcdef",
    "status": "succeeded",
    "amount": 10000,
    "currency": "USD",
    "provider": "stripe",
    "created": "2025-01-15T10:30:00Z"
  }
}
```

#### Create Customer
```http
POST /api/integrations/payment/customer/create
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "email": "customer@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "metadata": {
    "userId": "user_123",
    "signupDate": "2025-01-15"
  },
  "preferredProvider": "stripe"
}
```

#### Process Refund
```http
POST /api/integrations/payment/refund
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "paymentId": "pi_1234567890abcdef",
  "amount": 5000,
  "reason": "requested_by_customer",
  "provider": "stripe"
}
```

#### Webhook Handling
```http
POST /api/integrations/payment/webhook/stripe
Stripe-Signature: t=1234567890,v1=signature...
Content-Type: application/json

{
  "id": "evt_1234567890",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 10000,
      "currency": "USD"
    }
  }
}
```

---

## Communication Integrations

### Supported Providers
- **SendGrid**: Reliable email delivery service
- **Postmark**: High-deliverability transactional email
- **Twilio**: Programmable SMS and voice services

### Email API Endpoints

#### Send Email
```http
POST /api/integrations/communication/email/send
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Welcome to Eagle Platform",
  "html": "<h1>Welcome!</h1><p>Thank you for joining Eagle Platform.</p>",
  "text": "Welcome! Thank you for joining Eagle Platform.",
  "from": {
    "email": "noreply@eagleplatform.com",
    "name": "Eagle Platform"
  },
  "replyTo": "support@eagleplatform.com",
  "attachments": [
    {
      "filename": "welcome-guide.pdf",
      "content": "base64-encoded-content",
      "type": "application/pdf"
    }
  ],
  "templateData": {
    "userName": "John Doe",
    "activationLink": "https://app.eagleplatform.com/activate?token=abc123"
  },
  "preferredProvider": "sendgrid",
  "enableFailover": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "messageId": "sg_2025011510300001",
    "status": "sent",
    "provider": "sendgrid",
    "recipients": 1
  }
}
```

#### Send Template Email
```http
POST /api/integrations/communication/email/send
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "to": "customer@example.com",
  "template": {
    "id": "d-1234567890abcdef",
    "alias": "welcome-email"
  },
  "templateData": {
    "first_name": "John",
    "product_name": "Eagle Premium",
    "activation_url": "https://app.eagleplatform.com/activate"
  },
  "preferredProvider": "postmark"
}
```

### SMS API Endpoints

#### Send SMS
```http
POST /api/integrations/communication/sms/send
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "to": "+1234567890",
  "message": "Your Eagle Platform verification code is: 123456",
  "statusCallback": "https://api.eagleplatform.com/webhooks/sms-status",
  "validityPeriod": 3600,
  "preferredProvider": "twilio"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": {
    "messageId": "SM1234567890abcdef",
    "status": "queued",
    "provider": "twilio",
    "segments": 1
  }
}
```

#### Send Bulk SMS
```http
POST /api/integrations/communication/sms/bulk
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "recipients": [
    {
      "phone": "+1234567890",
      "data": {
        "name": "John",
        "code": "123456"
      }
    },
    {
      "phone": "+0987654321", 
      "data": {
        "name": "Jane",
        "code": "789012"
      }
    }
  ],
  "message": "Hi {{name}}, your verification code is: {{code}}",
  "batchSize": 10,
  "delayMs": 1000
}
```

### Validation Endpoints

#### Validate Email
```http
GET /api/integrations/communication/email/validate?email=test@example.com&provider=sendgrid
Authorization: Bearer <jwt-token>
```

#### Validate Phone
```http
GET /api/integrations/communication/phone/validate?phone=+1234567890&provider=twilio
Authorization: Bearer <jwt-token>
```

---

## Tax Integrations

### Supported Providers
- **Stripe Tax**: Global tax calculation with 30+ country support
- **TaxJar**: US sales tax specialization with SST certification  
- **Avalara**: Enterprise tax engine supporting 190+ countries

### Tax Calculation API

#### Calculate Tax
```http
POST /api/integrations/tax/calculate
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "amount": 100.00,
  "currency": "USD",
  "fromAddress": {
    "line1": "123 Business Street",
    "city": "San Francisco",
    "state": "CA", 
    "postalCode": "94105",
    "country": "US"
  },
  "toAddress": {
    "line1": "456 Customer Avenue",
    "city": "Los Angeles",
    "state": "CA",
    "postalCode": "90210", 
    "country": "US"
  },
  "lineItems": [
    {
      "description": "Premium Software License",
      "amount": 80.00,
      "quantity": 1,
      "taxCode": "D0000000"
    },
    {
      "description": "Setup Service",
      "amount": 20.00,
      "quantity": 1,
      "taxCode": "S0000000"
    }
  ],
  "customerDetails": {
    "taxExempt": false,
    "exemptionNumber": null
  },
  "shipping": {
    "amount": 5.00,
    "taxCode": "FR020100"
  },
  "preferredProvider": "stripe_tax"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tax calculated successfully",
  "data": {
    "provider": "stripe_tax",
    "calculation": {
      "calculationId": "taxcalc_2025011510300001",
      "totalTax": 8.40,
      "currency": "USD",
      "taxBreakdown": [
        {
          "reference": "item_1",
          "amount": 80.00,
          "taxAmount": 6.40,
          "taxableAmount": 80.00,
          "taxBreakdown": [
            {
              "type": "sales_tax",
              "rate": 8.0,
              "amount": 6.40,
              "jurisdiction": "CA, US",
              "inclusive": false
            }
          ]
        }
      ],
      "shippingTax": 0.40
    }
  }
}
```

#### Batch Tax Calculation
```http
POST /api/integrations/tax/batch-calculate
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "transactions": [
    {
      "amount": 100.00,
      "fromAddress": {/* address */},
      "toAddress": {/* address */}
    },
    {
      "amount": 200.00,
      "fromAddress": {/* address */},
      "toAddress": {/* address */}
    }
  ],
  "batchSize": 5,
  "delayMs": 200,
  "preferredProvider": "taxjar"
}
```

### Transaction Management

#### Create Tax Transaction
```http
POST /api/integrations/tax/transaction
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "transactionCode": "ORDER-2025-001",
  "type": "SalesInvoice",
  "customerCode": "CUSTOMER-123",
  "date": "2025-01-15",
  "fromAddress": {
    "line1": "123 Business Street",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94105",
    "country": "US"
  },
  "toAddress": {
    "line1": "456 Customer Avenue", 
    "city": "Los Angeles",
    "state": "CA",
    "postalCode": "90210",
    "country": "US"
  },
  "lineItems": [
    {
      "description": "Premium Subscription",
      "amount": 99.00,
      "quantity": 1,
      "taxCode": "D0000000",
      "discount": 0
    }
  ],
  "commit": true,
  "preferredProvider": "avalara"
}
```

#### Commit Transaction
```http
POST /api/integrations/tax/transaction/avalara/ORDER-2025-001/commit
Authorization: Bearer <jwt-token>
```

#### Void Transaction  
```http
POST /api/integrations/tax/transaction/taxjar/ORDER-2025-001/void
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "reason": "customer_cancelled"
}
```

### Utility Endpoints

#### Get Tax Rates
```http
GET /api/integrations/tax/rates?city=Los Angeles&state=CA&postalCode=90210&provider=taxjar
Authorization: Bearer <jwt-token>
```

#### Validate Address
```http
POST /api/integrations/tax/validate-address
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "line1": "123 Main Street",
  "city": "Beverly Hills",
  "state": "CA", 
  "postalCode": "90210",
  "country": "US"
}
```

#### Get Tax Codes
```http
GET /api/integrations/tax/codes?provider=avalara
Authorization: Bearer <jwt-token>
```

---

## Integration Management

### Configuration Management

#### Configure Provider
```http
POST /api/integrations/settings/configure
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "provider": "stripe",
  "category": "PAYMENT",
  "credentials": {
    "secretKey": "sk_live_...",
    "publishableKey": "pk_live_...",
    "webhookSecret": "whsec_..."
  },
  "configuration": {
    "currency": "USD",
    "captureMethod": "automatic",
    "paymentMethods": ["card", "apple_pay", "google_pay"],
    "rateLimits": {
      "requestsPerMinute": 100
    }
  },
  "isPrimary": true,
  "isActive": true,
  "priority": 1
}
```

#### List Integrations
```http
GET /api/integrations/settings/list?category=PAYMENT&isActive=true
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60f7b4b5c9d4a12345678901",
      "provider": "stripe",
      "category": "PAYMENT",
      "isActive": true,
      "isPrimary": true,
      "priority": 1,
      "configuration": {
        "currency": "USD",
        "captureMethod": "automatic"
      },
      "usage": {
        "totalRequests": 1250,
        "successfulRequests": 1238,
        "failedRequests": 12,
        "lastUsed": "2025-01-15T10:30:00Z"
      },
      "healthStatus": {
        "status": "HEALTHY",
        "lastCheck": "2025-01-15T10:29:00Z",
        "responseTime": 150
      },
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Update Integration
```http
PUT /api/integrations/settings/60f7b4b5c9d4a12345678901
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "configuration": {
    "currency": "USD",
    "captureMethod": "manual",
    "rateLimits": {
      "requestsPerMinute": 200
    }
  },
  "isActive": true
}
```

#### Test Integration
```http
POST /api/integrations/settings/60f7b4b5c9d4a12345678901/test
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "testEmail": "test@example.com",
  "testPhone": "+1234567890"
}
```

### Bulk Configuration
```http
POST /api/integrations/settings/bulk/configure
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "integrations": [
    {
      "provider": "sendgrid",
      "category": "EMAIL",
      "credentials": {
        "apiKey": "SG...."
      },
      "configuration": {
        "fromEmail": "noreply@eagleplatform.com"
      }
    },
    {
      "provider": "twilio", 
      "category": "SMS",
      "credentials": {
        "accountSid": "AC...",
        "authToken": "..."
      },
      "configuration": {
        "fromNumber": "+1234567890"
      }
    }
  ]
}
```

---

## UI Implementation Guide

### React Integration Dashboard

#### Provider Management Component
```jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Switch, Badge, Table, Modal, Form, Input, Select } from 'antd';
import { SettingOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const IntegrationDashboard = () => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configModal, setConfigModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/settings/list', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setIntegrations(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegration = async (id, isActive) => {
    try {
      const response = await fetch(`/api/integrations/settings/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        fetchIntegrations(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to toggle integration:', error);
    }
  };

  const testIntegration = async (integration) => {
    try {
      const testData = {};
      if (integration.category === 'EMAIL') {
        testData.testEmail = 'test@example.com';
      } else if (integration.category === 'SMS') {
        testData.testPhone = '+1234567890';
      }

      const response = await fetch(`/api/integrations/settings/${integration._id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Integration test successful!');
      } else {
        message.error('Integration test failed: ' + data.error);
      }
    } catch (error) {
      message.error('Test failed: ' + error.message);
    }
  };

  const columns = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider, record) => (
        <div>
          <strong style={{ textTransform: 'capitalize' }}>{provider}</strong>
          {record.isPrimary && <Badge count="Primary" style={{ marginLeft: 8 }} />}
        </div>
      )
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => (
        <Badge color={getCategoryColor(category)} text={category} />
      )
    },
    {
      title: 'Status',
      dataIndex: 'healthStatus',
      key: 'status',
      render: (health, record) => (
        <div>
          {record.isActive ? (
            health.status === 'HEALTHY' ? (
              <Badge status="success" text="Healthy" />
            ) : (
              <Badge status="error" text="Error" />
            )
          ) : (
            <Badge status="default" text="Inactive" />
          )}
        </div>
      )
    },
    {
      title: 'Usage',
      dataIndex: 'usage',
      key: 'usage',
      render: (usage) => (
        <div>
          <div>Total: {usage.totalRequests}</div>
          <div>Success Rate: {
            usage.totalRequests > 0 
              ? ((usage.successfulRequests / usage.totalRequests) * 100).toFixed(1)
              : 0
          }%</div>
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div>
          <Switch 
            checked={record.isActive}
            onChange={(checked) => toggleIntegration(record._id, checked)}
            style={{ marginRight: 8 }}
          />
          <Button 
            size="small" 
            onClick={() => testIntegration(record)}
            style={{ marginRight: 8 }}
          >
            Test
          </Button>
          <Button 
            size="small" 
            icon={<SettingOutlined />}
            onClick={() => openConfigModal(record)}
          >
            Configure
          </Button>
        </div>
      )
    }
  ];

  const getCategoryColor = (category) => {
    const colors = {
      'PAYMENT': 'green',
      'EMAIL': 'blue', 
      'SMS': 'orange',
      'TAX': 'purple'
    };
    return colors[category] || 'default';
  };

  return (
    <div>
      <Card title="Integration Management" extra={
        <Button type="primary" onClick={() => setConfigModal(true)}>
          Add Integration
        </Button>
      }>
        <Table 
          columns={columns}
          dataSource={integrations}
          rowKey="_id"
          loading={loading}
        />
      </Card>

      <Modal
        title="Configure Integration"
        visible={configModal}
        onCancel={() => setConfigModal(false)}
        width={600}
        footer={null}
      >
        <IntegrationConfigForm 
          form={form}
          onSubmit={(values) => {
            // Handle form submission
            console.log('Config values:', values);
            setConfigModal(false);
          }}
        />
      </Modal>
    </div>
  );
};

const IntegrationConfigForm = ({ form, onSubmit }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');

  const providerOptions = {
    'PAYMENT': [
      { label: 'Stripe', value: 'stripe' },
      { label: 'Braintree', value: 'braintree' }
    ],
    'EMAIL': [
      { label: 'SendGrid', value: 'sendgrid' },
      { label: 'Postmark', value: 'postmark' }
    ],
    'SMS': [
      { label: 'Twilio', value: 'twilio' }
    ],
    'TAX': [
      { label: 'Stripe Tax', value: 'stripe_tax' },
      { label: 'TaxJar', value: 'taxjar' },
      { label: 'Avalara', value: 'avalara' }
    ]
  };

  const getCredentialFields = (provider) => {
    const fields = {
      'stripe': ['secretKey', 'publishableKey', 'webhookSecret'],
      'braintree': ['merchantId', 'publicKey', 'privateKey'],
      'sendgrid': ['apiKey'],
      'postmark': ['serverToken'],
      'twilio': ['accountSid', 'authToken'],
      'stripe_tax': ['apiKey'],
      'taxjar': ['apiKey'],
      'avalara': ['accountId', 'licenseKey']
    };
    return fields[provider] || [];
  };

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item name="category" label="Category" rules={[{ required: true }]}>
        <Select onChange={setSelectedCategory}>
          <Select.Option value="PAYMENT">Payment</Select.Option>
          <Select.Option value="EMAIL">Email</Select.Option>
          <Select.Option value="SMS">SMS</Select.Option>
          <Select.Option value="TAX">Tax</Select.Option>
        </Select>
      </Form.Item>

      {selectedCategory && (
        <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
          <Select onChange={setSelectedProvider}>
            {providerOptions[selectedCategory]?.map(option => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}

      {selectedProvider && (
        <>
          <h4>Credentials</h4>
          {getCredentialFields(selectedProvider).map(field => (
            <Form.Item 
              key={field}
              name={['credentials', field]} 
              label={field.charAt(0).toUpperCase() + field.slice(1)}
              rules={[{ required: true }]}
            >
              <Input.Password placeholder={`Enter ${field}`} />
            </Form.Item>
          ))}

          <h4>Configuration</h4>
          {selectedCategory === 'EMAIL' && (
            <>
              <Form.Item name={['configuration', 'fromEmail']} label="From Email" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="noreply@eagleplatform.com" />
              </Form.Item>
              <Form.Item name={['configuration', 'fromName']} label="From Name">
                <Input placeholder="Eagle Platform" />
              </Form.Item>
            </>
          )}

          {selectedCategory === 'SMS' && (
            <Form.Item name={['configuration', 'fromNumber']} label="From Number" rules={[{ required: true }]}>
              <Input placeholder="+1234567890" />
            </Form.Item>
          )}

          <Form.Item name="isPrimary" valuePropName="checked">
            <Switch /> Set as Primary Provider
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Configure Integration
            </Button>
          </Form.Item>
        </>
      )}
    </Form>
  );
};

export default IntegrationDashboard;
```

#### Health Monitoring Component
```jsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Alert, Timeline, Badge } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const HealthMonitoring = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      // Fetch health data for all services
      const [paymentHealth, communicationHealth, taxHealth] = await Promise.all([
        fetch('/api/integrations/payment/health', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(res => res.json()),
        fetch('/api/integrations/communication/health', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(res => res.json()),
        fetch('/api/integrations/tax/health', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(res => res.json())
      ]);

      setHealthData({
        payment: paymentHealth.data,
        communication: communicationHealth.data,
        tax: taxHealth.data
      });
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatus = () => {
    if (!healthData) return 'loading';
    
    const allServices = [
      healthData.payment?.overall,
      healthData.communication?.overall,
      healthData.tax?.overall
    ];
    
    if (allServices.every(status => status === 'healthy')) return 'healthy';
    if (allServices.some(status => status === 'healthy')) return 'degraded';
    return 'critical';
  };

  const getStatusColor = (status) => {
    const colors = {
      'healthy': 'success',
      'degraded': 'warning', 
      'critical': 'error',
      'loading': 'default'
    };
    return colors[status] || 'default';
  };

  if (!healthData) {
    return <Card loading={loading}>Loading health data...</Card>;
  }

  const overallStatus = getOverallStatus();

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert
            message={`System Status: ${overallStatus.toUpperCase()}`}
            type={getStatusColor(overallStatus)}
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Col>

        <Col span={8}>
          <Card title="Payment Services">
            <ServiceHealthCard data={healthData.payment} />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Communication Services">
            <ServiceHealthCard data={healthData.communication} />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Tax Services">
            <ServiceHealthCard data={healthData.tax} />
          </Card>
        </Col>
      </Row>

      <Card title="Service Timeline" style={{ marginTop: 16 }}>
        <Timeline>
          <Timeline.Item color="green" icon={<CheckCircleOutlined />}>
            All payment providers operational - 2 minutes ago
          </Timeline.Item>
          <Timeline.Item color="blue" icon={<CheckCircleOutlined />}>
            SendGrid health check passed - 5 minutes ago
          </Timeline.Item>
          <Timeline.Item color="orange" icon={<ExclamationCircleOutlined />}>
            Twilio rate limit warning - 10 minutes ago
          </Timeline.Item>
          <Timeline.Item color="green" icon={<CheckCircleOutlined />}>
            Tax calculation services fully operational - 15 minutes ago
          </Timeline.Item>
        </Timeline>
      </Card>
    </div>
  );
};

const ServiceHealthCard = ({ data }) => {
  const healthyCount = Object.values(data).filter(service => 
    service.success || service.status === 'healthy'
  ).length;
  
  const totalCount = Object.keys(data).filter(key => key !== 'overall').length;
  const healthPercent = totalCount > 0 ? (healthyCount / totalCount) * 100 : 0;

  return (
    <div>
      <Statistic
        title="Service Health"
        value={healthPercent}
        precision={0}
        suffix="%"
        valueStyle={{ color: healthPercent === 100 ? '#3f8600' : healthPercent >= 50 ? '#faad14' : '#cf1322' }}
      />
      <Progress 
        percent={healthPercent} 
        strokeColor={healthPercent === 100 ? '#52c41a' : healthPercent >= 50 ? '#faad14' : '#ff4d4f'}
        showInfo={false}
        style={{ marginBottom: 16 }}
      />
      
      {Object.entries(data).map(([provider, status]) => {
        if (provider === 'overall') return null;
        
        const isHealthy = status.success || status.status === 'healthy';
        return (
          <div key={provider} style={{ marginBottom: 8 }}>
            <Badge 
              status={isHealthy ? 'success' : 'error'} 
              text={provider.charAt(0).toUpperCase() + provider.slice(1)}
            />
            {status.data?.responseTime && (
              <span style={{ marginLeft: 8, color: '#666' }}>
                ({status.data.responseTime}ms)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HealthMonitoring;
```

#### Payment Processing Component
```jsx
import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, InputNumber, message, Steps } from 'antd';
import { CreditCardOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';

const PaymentProcessor = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [paymentResult, setPaymentResult] = useState(null);

  const processPayment = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/payment/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      const data = await response.json();
      
      if (data.success) {
        setPaymentResult(data.data);
        setCurrentStep(2);
        message.success('Payment processed successfully!');
      } else {
        message.error('Payment failed: ' + data.error);
      }
    } catch (error) {
      message.error('Payment processing error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Customer Info',
      icon: <UserOutlined />
    },
    {
      title: 'Payment Details',
      icon: <CreditCardOutlined />
    },
    {
      title: 'Confirmation',
      icon: <CheckCircleOutlined />
    }
  ];

  return (
    <Card title="Process Payment">
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      {currentStep < 2 && (
        <Form
          form={form}
          layout="vertical"
          onFinish={processPayment}
          initialValues={{
            currency: 'USD',
            preferredProvider: 'stripe',
            enableFailover: true
          }}
        >
          {currentStep === 0 && (
            <>
              <Form.Item name="customerEmail" label="Customer Email" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="customer@example.com" />
              </Form.Item>
              
              <Form.Item name="customerName" label="Customer Name" rules={[{ required: true }]}>
                <Input placeholder="John Doe" />
              </Form.Item>

              <Button type="primary" onClick={() => setCurrentStep(1)}>
                Next Step
              </Button>
            </>
          )}

          {currentStep === 1 && (
            <>
              <Form.Item name="amount" label="Amount (in cents)" rules={[{ required: true }]}>
                <InputNumber
                  min={50}
                  style={{ width: '100%' }}
                  placeholder="10000"
                  formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>

              <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="USD">USD</Select.Option>
                  <Select.Option value="EUR">EUR</Select.Option>
                  <Select.Option value="GBP">GBP</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="paymentMethodId" label="Payment Method ID" rules={[{ required: true }]}>
                <Input placeholder="pm_1234567890abcdef" />
              </Form.Item>

              <Form.Item name="description" label="Description">
                <Input placeholder="Eagle Platform Subscription" />
              </Form.Item>

              <Form.Item name="preferredProvider" label="Payment Provider">
                <Select>
                  <Select.Option value="stripe">Stripe</Select.Option>
                  <Select.Option value="braintree">Braintree</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="enableFailover" valuePropName="checked">
                <Switch /> Enable Failover
              </Form.Item>

              <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>
                Previous
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Process Payment
              </Button>
            </>
          )}
        </Form>
      )}

      {currentStep === 2 && paymentResult && (
        <Card title="Payment Successful" type="inner">
          <p><strong>Payment ID:</strong> {paymentResult.paymentId}</p>
          <p><strong>Amount:</strong> ${(paymentResult.amount / 100).toFixed(2)} {paymentResult.currency}</p>
          <p><strong>Status:</strong> {paymentResult.status}</p>
          <p><strong>Provider:</strong> {paymentResult.provider}</p>
          <p><strong>Created:</strong> {new Date(paymentResult.created).toLocaleString()}</p>
          
          <Button 
            type="primary" 
            onClick={() => {
              setCurrentStep(0);
              setPaymentResult(null);
              form.resetFields();
            }}
          >
            Process Another Payment
          </Button>
        </Card>
      )}
    </Card>
  );
};

export default PaymentProcessor;
```

### Vue.js Implementation

#### Integration Settings Component
```vue
<template>
  <div class="integration-settings">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>Integration Settings</span>
          <el-button type="primary" @click="showAddDialog = true">
            Add Integration
          </el-button>
        </div>
      </template>

      <el-table :data="integrations" v-loading="loading">
        <el-table-column prop="provider" label="Provider">
          <template #default="scope">
            <div>
              <strong>{{ capitalize(scope.row.provider) }}</strong>
              <el-tag v-if="scope.row.isPrimary" type="success" size="small">Primary</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="category" label="Category">
          <template #default="scope">
            <el-tag :type="getCategoryType(scope.row.category)">
              {{ scope.row.category }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Status">
          <template #default="scope">
            <el-tag 
              :type="scope.row.isActive ? (scope.row.healthStatus.status === 'HEALTHY' ? 'success' : 'danger') : 'info'"
            >
              {{ scope.row.isActive ? (scope.row.healthStatus.status === 'HEALTHY' ? 'Healthy' : 'Error') : 'Inactive' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Usage">
          <template #default="scope">
            <div>
              <div>Total: {{ scope.row.usage.totalRequests }}</div>
              <div>Success: {{ getSuccessRate(scope.row.usage) }}%</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Actions">
          <template #default="scope">
            <el-switch
              v-model="scope.row.isActive"
              @change="toggleIntegration(scope.row._id)"
            />
            <el-button type="text" @click="testIntegration(scope.row)">Test</el-button>
            <el-button type="text" @click="configureIntegration(scope.row)">Configure</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add Integration Dialog -->
    <el-dialog v-model="showAddDialog" title="Add Integration" width="500px">
      <el-form :model="newIntegration" label-width="120px">
        <el-form-item label="Category" required>
          <el-select v-model="newIntegration.category" @change="onCategoryChange">
            <el-option label="Payment" value="PAYMENT" />
            <el-option label="Email" value="EMAIL" />
            <el-option label="SMS" value="SMS" />
            <el-option label="Tax" value="TAX" />
          </el-select>
        </el-form-item>

        <el-form-item label="Provider" required v-if="newIntegration.category">
          <el-select v-model="newIntegration.provider">
            <el-option
              v-for="provider in getProvidersForCategory(newIntegration.category)"
              :key="provider.value"
              :label="provider.label"
              :value="provider.value"
            />
          </el-select>
        </el-form-item>

        <div v-if="newIntegration.provider">
          <h4>Credentials</h4>
          <el-form-item
            v-for="field in getCredentialFields(newIntegration.provider)"
            :key="field"
            :label="capitalize(field)"
            required
          >
            <el-input
              v-model="newIntegration.credentials[field]"
              type="password"
              show-password
              :placeholder="`Enter ${field}`"
            />
          </el-form-item>

          <h4>Configuration</h4>
          <template v-if="newIntegration.category === 'EMAIL'">
            <el-form-item label="From Email" required>
              <el-input v-model="newIntegration.configuration.fromEmail" />
            </el-form-item>
            <el-form-item label="From Name">
              <el-input v-model="newIntegration.configuration.fromName" />
            </el-form-item>
          </template>

          <template v-if="newIntegration.category === 'SMS'">
            <el-form-item label="From Number" required>
              <el-input v-model="newIntegration.configuration.fromNumber" />
            </el-form-item>
          </template>

          <el-form-item>
            <el-checkbox v-model="newIntegration.isPrimary">
              Set as Primary Provider
            </el-checkbox>
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="showAddDialog = false">Cancel</el-button>
        <el-button type="primary" @click="addIntegration" :loading="adding">
          Add Integration
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'IntegrationSettings',
  data() {
    return {
      integrations: [],
      loading: false,
      showAddDialog: false,
      adding: false,
      newIntegration: {
        provider: '',
        category: '',
        credentials: {},
        configuration: {},
        isPrimary: false
      }
    }
  },
  mounted() {
    this.fetchIntegrations()
  },
  methods: {
    async fetchIntegrations() {
      this.loading = true
      try {
        const response = await fetch('/api/integrations/settings/list', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const data = await response.json()
        if (data.success) {
          this.integrations = data.data
        }
      } catch (error) {
        this.$message.error('Failed to fetch integrations')
      } finally {
        this.loading = false
      }
    },

    async toggleIntegration(id) {
      try {
        const response = await fetch(`/api/integrations/settings/${id}/toggle`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const data = await response.json()
        if (data.success) {
          this.$message.success('Integration status updated')
          this.fetchIntegrations()
        }
      } catch (error) {
        this.$message.error('Failed to update integration')
      }
    },

    async testIntegration(integration) {
      const testData = {}
      if (integration.category === 'EMAIL') {
        testData.testEmail = 'test@example.com'
      } else if (integration.category === 'SMS') {
        testData.testPhone = '+1234567890'
      }

      try {
        const response = await fetch(`/api/integrations/settings/${integration._id}/test`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testData)
        })
        
        const data = await response.json()
        if (data.success) {
          this.$message.success('Integration test successful!')
        } else {
          this.$message.error(`Test failed: ${data.error}`)
        }
      } catch (error) {
        this.$message.error(`Test error: ${error.message}`)
      }
    },

    async addIntegration() {
      this.adding = true
      try {
        const response = await fetch('/api/integrations/settings/configure', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.newIntegration)
        })

        const data = await response.json()
        if (data.success) {
          this.$message.success('Integration added successfully!')
          this.showAddDialog = false
          this.resetNewIntegration()
          this.fetchIntegrations()
        } else {
          this.$message.error(`Failed to add integration: ${data.error}`)
        }
      } catch (error) {
        this.$message.error(`Error: ${error.message}`)
      } finally {
        this.adding = false
      }
    },

    onCategoryChange() {
      this.newIntegration.provider = ''
      this.newIntegration.credentials = {}
      this.newIntegration.configuration = {}
    },

    getProvidersForCategory(category) {
      const providers = {
        'PAYMENT': [
          { label: 'Stripe', value: 'stripe' },
          { label: 'Braintree', value: 'braintree' }
        ],
        'EMAIL': [
          { label: 'SendGrid', value: 'sendgrid' },
          { label: 'Postmark', value: 'postmark' }
        ],
        'SMS': [
          { label: 'Twilio', value: 'twilio' }
        ],
        'TAX': [
          { label: 'Stripe Tax', value: 'stripe_tax' },
          { label: 'TaxJar', value: 'taxjar' },
          { label: 'Avalara', value: 'avalara' }
        ]
      }
      return providers[category] || []
    },

    getCredentialFields(provider) {
      const fields = {
        'stripe': ['secretKey', 'publishableKey', 'webhookSecret'],
        'braintree': ['merchantId', 'publicKey', 'privateKey'],
        'sendgrid': ['apiKey'],
        'postmark': ['serverToken'],
        'twilio': ['accountSid', 'authToken'],
        'stripe_tax': ['apiKey'],
        'taxjar': ['apiKey'],
        'avalara': ['accountId', 'licenseKey']
      }
      return fields[provider] || []
    },

    getCategoryType(category) {
      const types = {
        'PAYMENT': 'success',
        'EMAIL': 'primary',
        'SMS': 'warning',
        'TAX': 'info'
      }
      return types[category] || ''
    },

    getSuccessRate(usage) {
      if (usage.totalRequests === 0) return 0
      return ((usage.successfulRequests / usage.totalRequests) * 100).toFixed(1)
    },

    capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1)
    },

    resetNewIntegration() {
      this.newIntegration = {
        provider: '',
        category: '',
        credentials: {},
        configuration: {},
        isPrimary: false
      }
    }
  }
}
</script>

<style scoped>
.integration-settings {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-tag {
  margin-left: 8px;
}
</style>
```

---

## Authentication & Security

### JWT Authentication
All API endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key Authentication (Alternative)
For server-to-server communication, you can use API keys:

```http
X-API-Key: eagle_live_sk_1234567890abcdef
```

### Role-Based Access Control
Integration management requires admin privileges. User roles are validated in the JWT token payload.

### Credential Security
- All provider credentials are encrypted at rest using AES-256
- Sensitive data is excluded from API responses
- Webhook signatures are validated for security

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error",
    "provider": "stripe",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Common Error Codes

#### Authentication Errors
- `INVALID_TOKEN`: JWT token is invalid or expired
- `INSUFFICIENT_PERMISSIONS`: User lacks required admin privileges
- `API_KEY_INVALID`: API key authentication failed

#### Validation Errors
- `MISSING_REQUIRED_FIELDS`: Required request fields are missing
- `INVALID_FORMAT`: Field format validation failed
- `INVALID_AMOUNT`: Payment amount validation failed

#### Provider Errors
- `PROVIDER_NOT_FOUND`: Specified provider is not configured
- `PROVIDER_UNAVAILABLE`: Provider service is currently unavailable
- `RATE_LIMIT_EXCEEDED`: Provider rate limit has been exceeded
- `INVALID_CREDENTIALS`: Provider credentials are invalid

#### Integration Errors
- `CONFIGURATION_ERROR`: Integration configuration is invalid
- `HEALTH_CHECK_FAILED`: Provider health check failed
- `FAILOVER_EXHAUSTED`: All providers failed and failover is exhausted

---

## Rate Limiting

### Global Rate Limits
- **API Requests**: 1000 requests per minute per IP
- **Authentication**: 10 login attempts per minute per IP

### Provider-Specific Limits
- **Stripe**: 100 requests per second
- **SendGrid**: 600 requests per minute  
- **Twilio**: 1 request per second
- **TaxJar**: 1000 requests per minute
- **Avalara**: 5000 requests per minute

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642781400
Retry-After: 60
```

### Handling Rate Limits
```javascript
// Client-side rate limit handling
const makeRequest = async (url, options) => {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return makeRequest(url, options);
    }
    
    return response;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};
```

---

## Monitoring & Analytics

### Health Check Endpoints

#### Overall System Health
```http
GET /api/integrations/health
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "services": {
      "payment": "healthy",
      "communication": "healthy",  
      "tax": "degraded"
    },
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

#### Service-Specific Health
```http
GET /api/integrations/payment/health
GET /api/integrations/communication/health
GET /api/integrations/tax/health
```

### Usage Statistics

#### Provider Statistics
```http
GET /api/integrations/settings/stats
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stripe": {
      "provider": "stripe",
      "category": "PAYMENT",
      "usage": {
        "totalRequests": 1250,
        "successfulRequests": 1238,
        "failedRequests": 12,
        "lastUsed": "2025-01-15T10:30:00Z"
      },
      "healthStatus": {
        "status": "HEALTHY",
        "lastCheck": "2025-01-15T10:29:00Z",
        "responseTime": 150
      },
      "successRate": "99.04"
    }
  }
}
```

#### Usage Analytics Dashboard
```javascript
// Fetch usage analytics
const fetchUsageAnalytics = async (startDate, endDate) => {
  const response = await fetch(`/api/integrations/analytics/usage?startDate=${startDate}&endDate=${endDate}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const data = await response.json();
  return data;
};

// Example analytics data structure
{
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-15"
  },
  "summary": {
    "totalRequests": 15420,
    "successfulRequests": 15234,
    "failedRequests": 186,
    "averageResponseTime": 245
  },
  "byProvider": {
    "stripe": {
      "requests": 8500,
      "successRate": 99.2,
      "avgResponseTime": 180
    },
    "sendgrid": {
      "requests": 4200,
      "successRate": 98.8,
      "avgResponseTime": 320
    }
  },
  "byDay": [
    {
      "date": "2025-01-01",
      "requests": 980,
      "successRate": 99.1
    }
  ]
}
```

### Webhook Logs
```http
GET /api/integrations/webhooks/logs?provider=stripe&startDate=2025-01-01
Authorization: Bearer <jwt-token>
```

### Alert Configuration
```javascript
// Configure monitoring alerts
const alertConfig = {
  healthCheck: {
    enabled: true,
    interval: '5m',
    threshold: {
      responseTime: 5000, // 5 seconds
      errorRate: 0.05 // 5%
    }
  },
  notifications: {
    email: ['admin@eagleplatform.com'],
    slack: 'https://hooks.slack.com/services/...',
    webhook: 'https://api.eagleplatform.com/webhooks/alerts'
  }
};
```

---

## Conclusion

The Eagle Platform Integrations System provides a comprehensive, production-ready solution for managing multiple third-party service providers. With built-in failover, monitoring, and management capabilities, it ensures reliable operation while maintaining flexibility for future expansions.

For additional support or questions, contact the development team or refer to the individual provider documentation for specific implementation details.