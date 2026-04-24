const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  mongoose.set('strictQuery', true);

  if (!process.env.MONGO_URI) {
    return console.log('MONGO_URI is not defined');
  }

  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Do not exit process in production/serverless
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
