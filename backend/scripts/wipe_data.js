import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Room from '../models/Room.js';
import File from '../models/File.js';

dotenv.config();

const wipeData = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI is missing');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        console.log('Deleting all Rooms...');
        await Room.deleteMany({});

        console.log('Deleting all Files...');
        await File.deleteMany({});

        console.log('✅ Data wipe complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error wiping data:', err);
        process.exit(1);
    }
};

wipeData();
