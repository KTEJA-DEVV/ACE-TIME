/**
 * Migration Script: Remove Duplicate Call Participants
 * 
 * This script removes duplicate participant records from CallSession.guestIds arrays
 * and ensures CallParticipant records are unique per (callId, userId).
 * 
 * Run with: npx ts-node backend/src/scripts/migrate-deduplicate-participants.ts
 */

import mongoose from 'mongoose';
import { CallSession } from '../models/CallSession';
import { CallParticipant } from '../models/CallParticipant';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
// Try multiple possible paths for .env file
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend', '.env'),
];

for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    break;
  } catch (error) {
    // Continue to next path
  }
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acetime';

async function migrateDeduplicateParticipants() {
  try {
    console.log('🔄 Starting migration: Deduplicate call participants...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Step 1: Deduplicate CallSession.guestIds arrays
    console.log('\n📋 Step 1: Deduplicating CallSession.guestIds arrays...');
    const callSessions = await CallSession.find({});
    let sessionsUpdated = 0;
    let totalDuplicatesRemoved = 0;

    for (const session of callSessions) {
      if (!session.guestIds || session.guestIds.length === 0) continue;

      const originalLength = session.guestIds.length;
      
      // Deduplicate by converting to Map (keyed by userId string) and back to array
      const uniqueGuestIds = Array.from(
        new Map(
          session.guestIds.map(id => [id.toString(), id])
        ).values()
      );

      if (uniqueGuestIds.length < originalLength) {
        const duplicatesRemoved = originalLength - uniqueGuestIds.length;
        session.guestIds = uniqueGuestIds;
        session.metadata.participantCount = uniqueGuestIds.length + 1; // +1 for host
        await session.save();
        
        sessionsUpdated++;
        totalDuplicatesRemoved += duplicatesRemoved;
        console.log(`  ✅ Call ${session._id}: Removed ${duplicatesRemoved} duplicate(s)`);
      }
    }

    console.log(`\n✅ Step 1 Complete: Updated ${sessionsUpdated} sessions, removed ${totalDuplicatesRemoved} duplicate guestIds`);

    // Step 2: Create CallParticipant records for existing calls (if model exists)
    console.log('\n📋 Step 2: Creating CallParticipant records for existing calls...');
    let participantsCreated = 0;
    let participantsUpdated = 0;

    for (const session of callSessions) {
      // Check if host participant already exists
      const existingHostParticipant = await CallParticipant.findOne({
        callId: session._id,
        userId: session.hostId,
      });

      // Create or update participant record for host
      const hostParticipant = await CallParticipant.findOneAndUpdate(
        { callId: session._id, userId: session.hostId },
        {
          $setOnInsert: {
            callId: session._id,
            userId: session.hostId,
            joinedAt: session.startedAt || session.createdAt,
            leftAt: session.endedAt || null,
            duration: session.duration || null,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      if (!existingHostParticipant) {
        participantsCreated++;
      } else {
        participantsUpdated++;
      }

      // Create participant records for guests
      if (session.guestIds && session.guestIds.length > 0) {
        for (const guestId of session.guestIds) {
          // Check if guest participant already exists
          const existingGuestParticipant = await CallParticipant.findOne({
            callId: session._id,
            userId: guestId,
          });

          const guestParticipant = await CallParticipant.findOneAndUpdate(
            { callId: session._id, userId: guestId },
            {
              $setOnInsert: {
                callId: session._id,
                userId: guestId,
                joinedAt: session.startedAt || session.createdAt,
                leftAt: session.endedAt || null,
                duration: session.duration || null,
              },
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );

          if (!existingGuestParticipant) {
            participantsCreated++;
          } else {
            participantsUpdated++;
          }
        }
      }
    }

    console.log(`\n✅ Step 2 Complete: Created ${participantsCreated} new participant records, updated ${participantsUpdated} existing records`);

    // Step 3: Remove duplicate CallParticipant records (keep latest)
    console.log('\n📋 Step 3: Removing duplicate CallParticipant records (keeping latest)...');
    
    // Find all duplicate groups
    const duplicates = await CallParticipant.aggregate([
      {
        $group: {
          _id: { callId: '$callId', userId: '$userId' },
          count: { $sum: 1 },
          records: { $push: '$$ROOT' },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    let duplicatesRemoved = 0;

    for (const group of duplicates) {
      const { callId, userId } = group._id;
      const records = group.records;
      
      // Sort by createdAt (newest first) or joinedAt
      records.sort((a: any, b: any) => {
        const dateA = new Date(a.joinedAt || a.createdAt).getTime();
        const dateB = new Date(b.joinedAt || b.createdAt).getTime();
        return dateB - dateA; // Newest first
      });

      // Keep the first (latest) record, delete the rest
      const toKeep = records[0];
      const toDelete = records.slice(1);

      for (const record of toDelete) {
        await CallParticipant.findByIdAndDelete(record._id);
        duplicatesRemoved++;
        console.log(`  🗑️  Removed duplicate participant: callId=${callId}, userId=${userId}, _id=${record._id}`);
      }

      // Update the kept record with most complete data
      const mostComplete = records.reduce((best: any, current: any) => {
        if (!best.leftAt && current.leftAt) return current;
        if (!best.duration && current.duration) return current;
        return best;
      }, toKeep);

      if (mostComplete._id.toString() !== toKeep._id.toString()) {
        await CallParticipant.findByIdAndUpdate(toKeep._id, {
          leftAt: mostComplete.leftAt || toKeep.leftAt,
          duration: mostComplete.duration || toKeep.duration,
        });
      }
    }

    console.log(`\n✅ Step 3 Complete: Removed ${duplicatesRemoved} duplicate CallParticipant records`);

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`  - CallSessions updated: ${sessionsUpdated}`);
    console.log(`  - Duplicate guestIds removed: ${totalDuplicatesRemoved}`);
    console.log(`  - CallParticipant records created: ${participantsCreated}`);
    console.log(`  - CallParticipant records updated: ${participantsUpdated}`);
    console.log(`  - Duplicate CallParticipant records removed: ${duplicatesRemoved}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrateDeduplicateParticipants()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateDeduplicateParticipants };

