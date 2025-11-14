/**
 * Backfill Script: Link existing transactions to users via contract metadata
 * 
 * This script fixes transactions that have userId: null by:
 * 1. Finding the contractId in transaction metadata
 * 2. Looking up the contract to get the userId
 * 3. Updating the transaction with the correct userId
 */

const mongoose = require('mongoose');
const Transaction = require('../src/transaction/models/transaction.model');
const SignedContract = require('../src/models/signedContract.model');

// Load environment variables
require('dotenv').config();

async function backfillTransactionUserIds() {
    try {
        console.log('🔄 Starting transaction userId backfill...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB\n');

        // Find all transactions with null userId
        const transactionsWithNullUserId = await Transaction.find({
            userId: null,
            'metadata.contractId': { $exists: true },
        });

        console.log(`📊 Found ${transactionsWithNullUserId.length} transactions with null userId\n`);

        if (transactionsWithNullUserId.length === 0) {
            console.log('✅ No transactions to backfill. All transactions have userIds!\n');
            process.exit(0);
        }

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // Process each transaction
        for (const transaction of transactionsWithNullUserId) {
            const contractId = transaction.metadata?.contractId;

            if (!contractId) {
                console.log(`⚠️  Transaction ${transaction.transactionId} has no contractId in metadata`);
                failCount++;
                errors.push({
                    transactionId: transaction.transactionId,
                    reason: 'No contractId in metadata',
                });
                continue;
            }

            try {
                // Find the contract
                const contract = await SignedContract.findById(contractId);

                if (!contract) {
                    console.log(`⚠️  Contract ${contractId} not found for transaction ${transaction.transactionId}`);
                    failCount++;
                    errors.push({
                        transactionId: transaction.transactionId,
                        contractId,
                        reason: 'Contract not found',
                    });
                    continue;
                }

                if (!contract.userId) {
                    console.log(`⚠️  Contract ${contractId} has no userId for transaction ${transaction.transactionId}`);
                    failCount++;
                    errors.push({
                        transactionId: transaction.transactionId,
                        contractId,
                        reason: 'Contract has no userId',
                    });
                    continue;
                }

                // Update the transaction with userId
                transaction.userId = contract.userId;
                await transaction.save();

                console.log(`✅ Updated transaction ${transaction.transactionId} with userId: ${contract.userId}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Error processing transaction ${transaction.transactionId}:`, error.message);
                failCount++;
                errors.push({
                    transactionId: transaction.transactionId,
                    contractId,
                    reason: error.message,
                });
            }
        }

        console.log('\n📊 Backfill Summary:');
        console.log(`   Total transactions: ${transactionsWithNullUserId.length}`);
        console.log(`   Successfully updated: ${successCount}`);
        console.log(`   Failed: ${failCount}`);

        if (errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            errors.forEach((error) => {
                console.log(`   - Transaction ${error.transactionId}: ${error.reason}`);
            });
        }

        console.log('\n✅ Backfill complete!\n');
    } catch (error) {
        console.error('❌ Fatal error during backfill:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
        process.exit(0);
    }
}

// Run the script
backfillTransactionUserIds();
