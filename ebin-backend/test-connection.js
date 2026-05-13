require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connection SUCCESS!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection FAILED:', err.message);
    process.exit(1);
  });