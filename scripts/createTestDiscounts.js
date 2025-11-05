require('dotenv').config();
const mongoose = require('mongoose');
const { DiscountCode } = require('../src/payment/models/discount.model');

async function createTestDiscounts() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Create test discount codes
        const testDiscounts = [
            {
                code: 'WELCOME10',
                name: 'Welcome 10% Off',
                description: '10% discount for new users',
                type: 'percentage',
                value: 10,
                maxDiscountAmount: 50,
                isActive: true,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                usageLimits: {
                    totalUses: 1000,
                    perCustomer: 1
                },
                eligibility: {
                    newCustomersOnly: false,
                    billingCycles: ['monthly', 'annual']
                },
                createdBy: new mongoose.Types.ObjectId() // Dummy user ID
            },
            {
                code: 'SAVE20',
                name: '20% Off Everything',
                description: 'Limited time 20% discount',
                type: 'percentage',
                value: 20,
                maxDiscountAmount: 100,
                isActive: true,
                startDate: new Date(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                usageLimits: {
                    totalUses: 500,
                    perCustomer: 2
                },
                createdBy: new mongoose.Types.ObjectId()
            },
            {
                code: 'FIXED50',
                name: '$50 Fixed Discount',
                description: 'Get $50 off your purchase',
                type: 'fixed_amount',
                value: 50,
                isActive: true,
                startDate: new Date(),
                usageLimits: {
                    totalUses: 100,
                    perCustomer: 1
                },
                eligibility: {
                    minimumPurchaseAmount: 200
                },
                createdBy: new mongoose.Types.ObjectId()
            }
        ];

        console.log('🔄 Creating test discount codes...\n');

        for (const discountData of testDiscounts) {
            // Check if code already exists
            const existing = await DiscountCode.findOne({ code: discountData.code });

            if (existing) {
                console.log(`⚠️  Code ${discountData.code} already exists, skipping...`);
            } else {
                const discount = new DiscountCode(discountData);
                await discount.save();
                console.log(`✅ Created: ${discountData.code} - ${discountData.name}`);
                console.log(`   Type: ${discountData.type}, Value: ${discountData.value}`);
                console.log(`   Valid until: ${discountData.endDate ? discountData.endDate.toDateString() : 'Forever'}\n`);
            }
        }

        // Display all active discount codes
        console.log('\n📋 All Active Discount Codes:');
        console.log('='.repeat(60));

        const allDiscounts = await DiscountCode.find({ isActive: true }).lean();

        allDiscounts.forEach(discount => {
            console.log(`\n🎟️  ${discount.code}`);
            console.log(`   Name: ${discount.name}`);
            console.log(`   Type: ${discount.type} (${discount.value}${discount.type === 'percentage' ? '%' : ' USD'})`);
            console.log(`   Max Discount: ${discount.maxDiscountAmount || 'No limit'}`);
            console.log(`   Usage: ${discount.usage?.totalCount || 0}/${discount.usageLimits?.totalUses || 'Unlimited'}`);
            console.log(`   Valid Until: ${discount.endDate ? discount.endDate.toDateString() : 'No expiry'}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ Test discount codes setup completed!');

        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
createTestDiscounts();
