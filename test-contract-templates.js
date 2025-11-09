/**
 * Test script for Contract Templates API
 * Run this to test the newly implemented functionality
 */

const express = require('express');
const app = express();

// Mock req object for testing
const createMockReq = (body = {}, params = {}, query = {}, user = { id: 'test-user', firstName: 'Test', lastName: 'User', email: 'test@test.com' }) => ({
  body,
  params,
  query,
  user
});

// Mock res object for testing
const createMockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    console.log(`Response [${res.statusCode || 200}]:`, JSON.stringify(data, null, 2));
    return res;
  };
  return res;
};

async function testContractTemplates() {
  console.log('🧪 Testing Contract Templates API...\n');

  try {
    // Import the controller functions
    const {
      createContractTemplate,
      getContractTemplates,
      getContractTemplate,
      updateContractTemplate,
      deleteContractTemplate,
      cloneTemplate
    } = require('./src/contract/controllers/enhancedContract.controller');

    let createdTemplateId = null;

    // Test 1: Create Template
    console.log('1️⃣ Testing Create Template...');
    const createReq = createMockReq({
      name: 'Test Investment Agreement',
      description: 'A test investment agreement template',
      category: 'investment_agreement',
      content: {
        body: 'This is a test investment agreement for {{investor_name}} investing {{investment_amount}} in {{company_name}}.',
        variables: [
          {
            name: 'investor_name',
            label: 'Investor Name',
            type: 'text',
            required: true
          },
          {
            name: 'investment_amount',
            label: 'Investment Amount',
            type: 'currency',
            required: true
          },
          {
            name: 'company_name',
            label: 'Company Name',
            type: 'text',
            required: true
          }
        ]
      },
      config: {
        applicablePlans: ['plan_test_123'],
        signingRequirements: {
          requireSignature: true,
          allowTypedSignature: true
        }
      },
      metadata: {
        tags: ['investment', 'legal'],
        jurisdiction: 'US'
      },
      legal: {
        requiresSignature: true,
        signatureType: 'electronic'
      }
    });

    const createRes = createMockRes();
    await createContractTemplate(createReq, createRes);
    
    if (createRes.data?.success) {
      createdTemplateId = createRes.data.data.id;
      console.log('✅ Template created successfully!\n');
    } else {
      console.log('❌ Template creation failed\n');
      return;
    }

    // Test 2: Get All Templates
    console.log('2️⃣ Testing Get All Templates...');
    const getReq = createMockReq({}, {}, {});
    const getRes = createMockRes();
    await getContractTemplates(getReq, getRes);
    
    if (getRes.data?.success) {
      console.log(`✅ Retrieved ${getRes.data.data.length} templates\n`);
    } else {
      console.log('❌ Failed to get templates\n');
    }

    // Test 3: Get Single Template
    console.log('3️⃣ Testing Get Single Template...');
    const getSingleReq = createMockReq({}, { templateId: createdTemplateId }, {});
    const getSingleRes = createMockRes();
    await getContractTemplate(getSingleReq, getSingleRes);
    
    if (getSingleRes.data?.success) {
      console.log('✅ Retrieved template by ID\n');
    } else {
      console.log('❌ Failed to get single template\n');
    }

    // Test 4: Update Template
    console.log('4️⃣ Testing Update Template...');
    const updateReq = createMockReq({
      name: 'Updated Test Investment Agreement',
      description: 'An updated test investment agreement template'
    }, { templateId: createdTemplateId }, {});
    const updateRes = createMockRes();
    await updateContractTemplate(updateReq, updateRes);
    
    if (updateRes.data?.success) {
      console.log('✅ Template updated successfully\n');
    } else {
      console.log('❌ Template update failed\n');
    }

    // Test 5: Clone Template
    console.log('5️⃣ Testing Clone Template...');
    const cloneReq = createMockReq({
      newName: 'Cloned Investment Agreement'
    }, { templateId: createdTemplateId }, {});
    const cloneRes = createMockRes();
    await cloneTemplate(cloneReq, cloneRes);
    
    let clonedTemplateId = null;
    if (cloneRes.data?.success) {
      clonedTemplateId = cloneRes.data.data.id;
      console.log('✅ Template cloned successfully\n');
    } else {
      console.log('❌ Template cloning failed\n');
    }

    // Test 6: Delete Template (Soft Delete)
    console.log('6️⃣ Testing Soft Delete Template...');
    const deleteReq = createMockReq({}, { templateId: clonedTemplateId || createdTemplateId }, { permanent: 'false' });
    const deleteRes = createMockRes();
    await deleteContractTemplate(deleteReq, deleteRes);
    
    if (deleteRes.data?.success) {
      console.log('✅ Template soft deleted successfully\n');
    } else {
      console.log('❌ Template deletion failed\n');
    }

    console.log('🎉 All tests completed!\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Mock database connection for testing
  const mongoose = require('mongoose');
  
  console.log('🔄 Connecting to database...\n');
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log('✅ Connected to database\n');
    testContractTemplates().then(() => {
      console.log('🔚 Test completed. Closing connection...');
      mongoose.connection.close();
    });
  }).catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });
}

module.exports = { testContractTemplates };