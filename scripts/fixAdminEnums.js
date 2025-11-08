/**
 * Script: fixAdminEnums.js
 * Purpose: Normalize legacy adminLevel and department values in AdminUser documents
 * Usage: NODE_ENV=development node scripts/fixAdminEnums.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../src/config/db');

dotenv.config();

// Load model after connecting (require path relative to repo root)
const AdminUser = require('../src/admin/models/adminUser.model');

async function run() {
  try {
    await connectDB();

    // Map of legacy values -> canonical
    const adminMap = {
      admin: 'super_admin',
      superadmin: 'super_admin',
      'super-admin': 'super_admin',
      finance: 'finance_admin',
      growth: 'growth_marketing',
      marketing: 'growth_marketing'
    };

    const deptMap = {
      engineering: 'technology',
      eng: 'technology',
      'engineering & development': 'technology',
      'human resources': 'hr',
      ops: 'operations'
    };

    // Find docs with legacy adminLevel values
    const adminKeys = Object.keys(adminMap);
    const deptKeys = Object.keys(deptMap);

    const adminQuery = { adminLevel: { $in: adminKeys } };
    const deptQuery = { department: { $in: deptKeys } };

    const toFixAdmin = await AdminUser.find(adminQuery).lean();
    const toFixDept = await AdminUser.find(deptQuery).lean();

    console.log(`Found ${toFixAdmin.length} adminLevel docs, ${toFixDept.length} department docs to check`);

    // Update adminLevel docs
    for (const doc of toFixAdmin) {
      const current = (doc.adminLevel || '').toLowerCase().trim();
      const mapped = adminMap[current];
      if (mapped) {
        console.log(`Updating ${doc._id} adminLevel: ${doc.adminLevel} -> ${mapped}`);
        await AdminUser.updateOne({ _id: doc._id }, { $set: { adminLevel: mapped } });
      }
    }

    // Update department docs
    for (const doc of toFixDept) {
      const current = (doc.department || '').toLowerCase().trim();
      const mapped = deptMap[current];
      if (mapped) {
        console.log(`Updating ${doc._id} department: ${doc.department} -> ${mapped}`);
        await AdminUser.updateOne({ _id: doc._id }, { $set: { department: mapped } });
      }
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

run();
