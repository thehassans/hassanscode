import mongoose from 'mongoose';
import WaSession from './src/modules/models/WaSession.js';

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buysial')
  .then(async () => {
    const sessions = await WaSession.find({}).sort({ connectedAt: -1 }).limit(5).lean();
    console.log('Recent WaSession entries:');
    sessions.forEach((s, i) => {
      console.log(`${i+1}. ID: ${s._id}`);
      console.log(`   phone: '${s.phone}'`);
      console.log(`   number: '${s.number}'`);
      console.log(`   active: ${s.active}`);
      console.log(`   connectedAt: ${s.connectedAt}`);
      console.log('');
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });