const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    // Auth controllers
    'src/controllers/auth/forgotPassword.js',
    'src/controllers/auth/resetPassword.js',
    'src/controllers/auth/getAuthProfile.js',
    'src/controllers/auth/activation.js',

    // User controllers
    'src/controllers/user/getProfile.js',
    'src/controllers/user/deleteUser.js',

    // Admin controllers
    'src/controllers/admin/updateUserSubscription.js',
    'src/controllers/admin/getAllUsers.js',

    // Dashboard controllers
    'src/dashboard/controllers/dashboard/getMetrics.js',
    'src/dashboard/controllers/dashboard/subscriberController.js'
];

const rootDir = path.join(__dirname, '..');

console.log('🔧 Fixing remaining User model imports...\n');

let successCount = 0;
let errorCount = 0;

filesToUpdate.forEach(relativeFilePath => {
    const filePath = path.join(rootDir, relativeFilePath);

    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  File not found: ${relativeFilePath}`);
            errorCount++;
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        // Calculate the depth (how many ../ needed)
        const depth = relativeFilePath.split('/').length - 2; // -2 for src and file itself
        const correctPath = '../'.repeat(depth) + 'user/models/user.model';

        // Replace old imports
        const oldPatterns = [
            /require\(['"]\.\.\/\.\.\/models\/user\.model['"]\)/g,
            /require\(['"]\.\.\/models\/user\.model['"]\)/g
        ];

        let updated = false;
        oldPatterns.forEach(pattern => {
            if (content.match(pattern)) {
                content = content.replace(pattern, `require("${correctPath}")`);
                updated = true;
            }
        });

        if (updated) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated: ${relativeFilePath}`);
            successCount++;
        } else {
            console.log(`⏭️  No changes needed: ${relativeFilePath}`);
        }

    } catch (error) {
        console.error(`❌ Error updating ${relativeFilePath}:`, error.message);
        errorCount++;
    }
});

// Fix admin/utils/rbac.utils.js separately (has dynamic require)
const rbacUtilsPath = path.join(rootDir, 'src/admin/utils/rbac.utils.js');
try {
    if (fs.existsSync(rbacUtilsPath)) {
        let content = fs.readFileSync(rbacUtilsPath, 'utf8');

        if (content.includes("require('../../models/user.model')")) {
            content = content.replace(
                /require\('\.\.\/\.\.\/models\/user\.model'\)/g,
                "require('../../user/models/user.model')"
            );
            fs.writeFileSync(rbacUtilsPath, content, 'utf8');
            console.log(`✅ Updated: src/admin/utils/rbac.utils.js (dynamic require)`);
            successCount++;
        }
    }
} catch (error) {
    console.error(`❌ Error updating rbac.utils.js:`, error.message);
    errorCount++;
}

console.log('\n' + '='.repeat(50));
console.log(`✅ Successfully updated: ${successCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log('='.repeat(50));

if (errorCount === 0) {
    console.log('\n🎉 All remaining imports fixed successfully!');
} else {
    console.log('\n⚠️  Some files had errors. Please check manually.');
}
