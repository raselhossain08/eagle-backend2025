const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to database
const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
    return conn.connection.db;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Get all collections and their details
const checkAllCollections = async () => {
  try {
    const db = await connectDB();
    
    console.log('\n🔍 Checking all collections in the database...\n');
    console.log('=' .repeat(80));
    
    // Get list of all collections
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('📭 No collections found in the database.');
      return;
    }
    
    console.log(`📊 Found ${collections.length} collection(s):\n`);
    
    // Create a summary table
    const collectionData = [];
    
    for (const collection of collections) {
      const collectionName = collection.name;
      
      try {
        // Get document count
        const count = await db.collection(collectionName).countDocuments();
        
        // Get a sample document to show structure (if exists)
        const sampleDoc = await db.collection(collectionName).findOne();
        
        // Get collection stats
        const stats = await db.collection(collectionName).stats();
        
        collectionData.push({
          name: collectionName,
          count: count,
          size: stats.size || 0,
          avgDocSize: stats.avgObjSize || 0,
          hasDocuments: count > 0,
          sampleFields: sampleDoc ? Object.keys(sampleDoc).filter(key => key !== '_id').slice(0, 5) : []
        });
        
      } catch (error) {
        console.log(`⚠️  Error getting stats for ${collectionName}: ${error.message}`);
        collectionData.push({
          name: collectionName,
          count: 'Error',
          size: 'Error',
          avgDocSize: 'Error',
          hasDocuments: false,
          sampleFields: []
        });
      }
    }
    
    // Sort collections by document count (descending)
    collectionData.sort((a, b) => {
      if (typeof a.count === 'number' && typeof b.count === 'number') {
        return b.count - a.count;
      }
      return 0;
    });
    
    // Display summary table
    console.log('📋 Collection Summary:');
    console.log('-'.repeat(80));
    console.log(
      '| ' + 
      'Collection Name'.padEnd(25) + 
      ' | ' + 
      'Documents'.padEnd(10) + 
      ' | ' + 
      'Size (bytes)'.padEnd(12) + 
      ' | ' +
      'Sample Fields'.padEnd(25) + 
      ' |'
    );
    console.log('-'.repeat(80));
    
    for (const collection of collectionData) {
      const name = collection.name.length > 25 ? collection.name.substring(0, 22) + '...' : collection.name;
      const count = typeof collection.count === 'number' ? collection.count.toLocaleString() : 'Error';
      const size = typeof collection.size === 'number' ? collection.size.toLocaleString() : 'Error';
      const fields = collection.sampleFields.join(', ');
      const truncatedFields = fields.length > 25 ? fields.substring(0, 22) + '...' : fields;
      
      console.log(
        '| ' + 
        name.padEnd(25) + 
        ' | ' + 
        count.padEnd(10) + 
        ' | ' + 
        size.padEnd(12) + 
        ' | ' +
        truncatedFields.padEnd(25) + 
        ' |'
      );
    }
    console.log('-'.repeat(80));
    
    // Show detailed information for collections with documents
    console.log('\n📝 Detailed Information:\n');
    
    for (const collection of collectionData) {
      if (collection.hasDocuments && typeof collection.count === 'number' && collection.count > 0) {
        console.log(`\n🗂️  Collection: ${collection.name}`);
        console.log(`   📊 Documents: ${collection.count.toLocaleString()}`);
        console.log(`   💾 Total Size: ${(collection.size / 1024).toFixed(2)} KB`);
        console.log(`   📏 Avg Doc Size: ${collection.avgDocSize} bytes`);
        
        if (collection.sampleFields.length > 0) {
          console.log(`   🏷️  Sample Fields: ${collection.sampleFields.join(', ')}`);
        }
        
        // Show a sample document (first 3 fields)
        try {
          const sampleDoc = await db.collection(collection.name).findOne();
          if (sampleDoc) {
            console.log('   📄 Sample Document Structure:');
            const fieldsToShow = Object.entries(sampleDoc).slice(0, 3);
            for (const [key, value] of fieldsToShow) {
              let displayValue = value;
              if (typeof value === 'object' && value !== null) {
                displayValue = Array.isArray(value) ? `[Array(${value.length})]` : '[Object]';
              } else if (typeof value === 'string' && value.length > 50) {
                displayValue = value.substring(0, 47) + '...';
              }
              console.log(`      ${key}: ${displayValue}`);
            }
            if (Object.keys(sampleDoc).length > 3) {
              console.log(`      ... and ${Object.keys(sampleDoc).length - 3} more fields`);
            }
          }
        } catch (error) {
          console.log(`      ⚠️ Error reading sample document: ${error.message}`);
        }
      } else if (typeof collection.count === 'number' && collection.count === 0) {
        console.log(`\n📭 Collection: ${collection.name} (Empty)`);
      }
    }
    
    // Summary statistics
    const totalCollections = collectionData.length;
    const totalDocuments = collectionData.reduce((sum, col) => {
      return sum + (typeof col.count === 'number' ? col.count : 0);
    }, 0);
    const totalSize = collectionData.reduce((sum, col) => {
      return sum + (typeof col.size === 'number' ? col.size : 0);
    }, 0);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Database Summary:');
    console.log(`   🗂️  Total Collections: ${totalCollections}`);
    console.log(`   📄 Total Documents: ${totalDocuments.toLocaleString()}`);
    console.log(`   💾 Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error checking collections:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n📴 Database connection closed.');
    process.exit(0);
  }
};

// Run the check
checkAllCollections();