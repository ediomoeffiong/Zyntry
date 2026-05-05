const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Workspace = require('./src/models/Workspace');
const connectDB = require('./src/config/db');

dotenv.config();

const migrateSlugs = async () => {
  try {
    await connectDB();
    
    const workspaces = await Workspace.find({ slug: { $exists: false } });
    console.log(`Found ${workspaces.length} workspaces without slugs.`);
    
    for (const ws of workspaces) {
      let baseSlug = ws.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      let slug = baseSlug;
      let counter = 1;
      
      // Ensure uniqueness
      while (await Workspace.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      ws.slug = slug;
      await ws.save();
      console.log(`Updated workspace "${ws.name}" with slug "${slug}".`);
    }
    
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateSlugs();
