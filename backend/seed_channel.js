const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Channel = require('./src/models/Channel');
const User = require('./src/models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne();
    if (!user) {
      console.log('No users found. Please register first.');
      process.exit(1);
    }

    const existingChannel = await Channel.findOne({ name: 'General' });
    if (existingChannel) {
      console.log('General channel already exists');
      if (!existingChannel.members.includes(user._id)) {
        existingChannel.members.push(user._id);
        await existingChannel.save();
        console.log('Added user to General channel');
      }
    } else {
      await Channel.create({
        name: 'General',
        createdBy: user._id,
        members: [user._id]
      });
      console.log('Created General channel');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding channel:', error);
    process.exit(1);
  }
};

seed();
