import mongoose, { Document, Schema } from 'mongoose';

export interface ICallParticipant extends Document {
  _id: mongoose.Types.ObjectId;
  callId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
  leftAt?: Date;
  duration?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

const callParticipantSchema = new Schema<ICallParticipant>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'CallSession',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Unique constraint on (callId, userId) to prevent duplicates
callParticipantSchema.index({ callId: 1, userId: 1 }, { unique: true });

// Index for efficient queries
callParticipantSchema.index({ userId: 1, joinedAt: -1 });
callParticipantSchema.index({ callId: 1, joinedAt: 1 });

export const CallParticipant = mongoose.model<ICallParticipant>('CallParticipant', callParticipantSchema);

