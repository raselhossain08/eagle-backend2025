/**
 * Quick Fix Script for Existing Users
 * Run this to sync subscriptions for users already in database
 */

// API Configuration
const API_URL = 'http://localhost:5000'; // Change to your backend URL
const WP_API_URL = 'https://eagle.cool/wp-json/eagle/v1/subscriptions';
const WP_API_KEY = 'your-api-key-here'; // Get from WordPress
const ADMIN_TOKEN = 'your-admin-jwt-token'; // Get from login

// Sync all existing users with their WordPress subscriptions
fetch(`${API_URL}/api/subscription/sync-existing-users`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({
        wpApiUrl: WP_API_URL,
        wpApiKey: WP_API_KEY
    })
})
    .then(res => res.json())
    .then(data => {
        console.log('✅ Sync Response:', data);

        if (data.success) {
            console.log(`\n📊 Results:`);
            console.log(`Total: ${data.data.total}`);
            console.log(`Updated: ${data.data.updated}`);
            console.log(`User Not Found: ${data.data.userNotFound}`);
            console.log(`Failed: ${data.data.failed}`);

            console.log('\n🎉 Sync completed! Refresh your dashboard to see updated subscriptions.');
        } else {
            console.error('❌ Sync failed:', data.error);
        }
    })
    .catch(error => {
        console.error('❌ Error:', error);
    });
