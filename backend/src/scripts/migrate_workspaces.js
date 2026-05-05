const mongoose = require('mongoose');
require('dotenv').config({ path: '../../.env' }); // try default path first if it exists, but actually it's running from backend/
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: '../.env' });
const Workspace = require('../models/Workspace');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to DB. Migrating workspaces...');
  
  const workspaces = await Workspace.find();
  for (const workspace of workspaces) {
    let modified = false;
    
    workspace.members = workspace.members.map(member => {
      // If the member is an ObjectId (legacy) rather than an object
      if (mongoose.Types.ObjectId.isValid(member) && !member.user) {
        modified = true;
        // Default the creator to owner, everyone else to member
        const role = workspace.createdBy.toString() === member.toString() ? 'owner' : 'member';
        return {
          user: member,
          role: role,
          allowedChannels: []
        };
      }
      return member;
    });

    if (modified) {
      // We must tell mongoose that the array was modified because we are mutating elements manually
      workspace.markModified('members');
      await workspace.save();
      console.log(`Migrated workspace: ${workspace.name}`);
    } else {
      console.log(`Skipped workspace (already migrated): ${workspace.name}`);
    }
  }

  console.log('Migration complete.');
  process.exit(0);
}).catch(err => {
  console.error('Error connecting to DB:', err);
  process.exit(1);
});
