import mongoose, { Document, Schema } from 'mongoose';

export interface IFriendship extends Document {
  _id: mongoose.Types.ObjectId;
  userId1: mongoose.Types.ObjectId;
  userId2: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  lastInteraction: Date;
  callHistory: Array<{
    callId: string;
    type: 'video' | 'audio';
    duration: number;
    timestamp: Date;
  }>;
}

const friendshipSchema = new Schema<IFriendship>(
  {
    userId1: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userId2: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending',
    },
    lastInteraction: {
      type: Date,
      default: Date.now,
    },
    callHistory: [{
      callId: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ['video', 'audio'],
        required: true,
      },
      duration: {
        type: Number,
        default: 0,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Ensure unique friendship pairs
friendshipSchema.index({ userId1: 1, userId2: 1 }, { unique: true });
friendshipSchema.index({ userId1: 1, status: 1 });
friendshipSchema.index({ userId2: 1, status: 1 });

export const Friendship = mongoose.model<IFriendship>('Friendship', friendshipSchema);

