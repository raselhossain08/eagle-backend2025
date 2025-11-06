const fs = require('fs');
const path = require('path');

console.log('🔧 Updating all User model imports to use single source...\n');

const updates = [
    // src/ directory files that use ../models/user.model
    {
        file: 'src/services/wordpressAuth.service.js',
        from: "const User = require('../models/user.model');",
        to: "const User = require('../user/models/user.model');"
    },
    {
        file: 'src/utils/processExistingContracts.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    {
        file: 'src/services/downgradeProcessor.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    {
        file: 'src/middlewares/rbacAuth.middleware.js',
        from: "    const User = require('../models/user.model');",
        to: "    const User = require('../user/models/user.model');"
    },
    {
        file: 'src/middlewares/auth.middleware.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    {
        file: 'src/controllers/contract.controller.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    {
        file: 'src/controllers/contractPayment.controller.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    {
        file: 'src/controllers/auth/login.js',
        from: 'const User = require("../../models/user.model");',
        to: 'const User = require("../../user/models/user.model");'
    },
    // src/user/controllers - use ../models
    {
        file: 'src/user/controllers/publicUser.controller.js',
        from: 'const PublicUser = require("../models/user.model");',
        to: 'const User = require("../models/user.model");'
    },
    {
        file: 'src/user/controllers/adminDashboard.controller.js',
        from: 'const PublicUser = require("../models/user.model");',
        to: 'const User = require("../models/user.model");'
    },
    // src/subscription/controllers - use ../../models
    {
        file: 'src/subscription/controllers/subscription-analytics.controller.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    },
    {
        file: 'src/subscription/controllers/subscriberLifecycleComplete.controller.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    },
    // src/support/
    {
        file: 'src/support/services/emailResend.service.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    },
    {
        file: 'src/support/controllers/userNotes.controller.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    },
    {
        file: 'src/support/controllers/impersonation.controller.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    },
    {
        file: 'src/support/controllers/emailResend.controller.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    },
    // src/dashboard/
    {
        file: 'src/dashboard/services/support.service.js',
        from: "const User = require('../models/user.model');",
        to: "const User = require('../user/models/user.model');"
    },
    {
        file: 'src/dashboard/services/emailResend.service.js',
        from: "const User = require('../models/user.model');",
        to: "const User = require('../user/models/user.model');"
    },
    {
        file: 'src/dashboard/controllers/notification.controller.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    {
        file: 'src/dashboard/controllers/search.controller.js',
        from: 'const User = require("../models/user.model");',
        to: 'const User = require("../user/models/user.model");'
    },
    // src/payment/
    {
        file: 'src/payment/services/paymentTokenMigration.service.js',
        from: "const User = require('../models/user.model');",
        to: "const User = require('../user/models/user.model');"
    },
    {
        file: 'src/payment/controllers/dunning.controller.js',
        from: "const User = require('../../models/user.model');",
        to: "const User = require('../../user/models/user.model');"
    }
];

let successCount = 0;
let errorCount = 0;
let notFoundCount = 0;

updates.forEach(update => {
    const filePath = path.join(__dirname, '..', update.file);

    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  File not found: ${update.file}`);
            notFoundCount++;
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        if (content.includes(update.from)) {
            content = content.replace(update.from, update.to);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated: ${update.file}`);
            successCount++;
        } else {
            console.log(`⏭️  Skipped (already updated or not found): ${update.file}`);
            notFoundCount++;
        }
    } catch (error) {
        console.error(`❌ Error updating ${update.file}:`, error.message);
        errorCount++;
    }
});

console.log('\n' + '='.repeat(80));
console.log('📊 Update Summary:');
console.log('='.repeat(80));
console.log(`   ✅ Successfully updated: ${successCount} files`);
console.log(`   ⏭️  Skipped/Not found: ${notFoundCount} files`);
console.log(`   ❌ Errors: ${errorCount} files`);
console.log('');

if (successCount > 0) {
    console.log('✅ All imports updated to use: src/user/models/user.model.js');
    console.log('\n📋 Next steps:');
    console.log('   1. Delete src/models/user.model.js (forwarding file)');
    console.log('   2. Test the application');
    console.log('   3. Verify all features working correctly');
}
