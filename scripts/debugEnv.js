require('dotenv').config();

console.log('Environment Variables Check:');
console.log('━'.repeat(60));
console.log('PAYPAL_MODE:', process.env.PAYPAL_MODE);
console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID?.substring(0, 20) + '...');
console.log('PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET?.substring(0, 20) + '...');
console.log('');
console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY?.substring(0, 20) + '...');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY?.substring(0, 20) + '...');
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 20) + '...');
console.log('━'.repeat(60));
