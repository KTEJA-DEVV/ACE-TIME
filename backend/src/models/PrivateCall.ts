import mongoose, { Document, Schema } from 'mongoose';

export interface IPrivateCall extends Document {
  _id: mongoose.Types.ObjectId;
  callerId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  type: 'video' | 'audio';
  status: 'ringing' | 'active' | 'ended' | 'missed';
  callId: string; // Unique call identifier
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  interface: 'facetime'; // Always 'facetime' for private calls
  conversationId?: mongoose.Types.ObjectId; // Link to conversation if exists
}

const privateCallSchema = new Schema<IPrivateCall>(
  {
    callerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['video', 'audio'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'active', 'ended', 'missed'],
      default: 'ringing',
    },
    callId: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: Date,
    duration: {
      type: Number,
      default: 0,
    },
    interface: {
      type: String,
      enum: ['facetime'],
      default: 'facetime',
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    },
  },
  {
    timestamps: true,
  }
);

privateCallSchema.index({ callerId: 1, status: 1 });
privateCallSchema.index({ recipientId: 1, status: 1 });
privateCallSchema.index({ callId: 1 }, { unique: true });

export const PrivateCall = mongoose.model<IPrivateCall>('PrivateCall', privateCallSchema);

