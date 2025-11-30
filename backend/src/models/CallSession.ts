import mongoose, { Document, Schema } from 'mongoose';

export interface ICallSession extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: string;
  hostId: mongoose.Types.ObjectId;
  guestIds: mongoose.Types.ObjectId[];
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  recordingUrl?: string;
  recordingKey?: string;
  transcriptId?: mongoose.Types.ObjectId;
  notesId?: mongoose.Types.ObjectId;
  status: 'waiting' | 'active' | 'ended' | 'failed';
  metadata: {
    audioOnly: boolean;
    recordingSize?: number;
    participantCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const callSessionSchema = new Schema<ICallSession>(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    guestIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    recordingKey: {
      type: String,
      default: null,
    },
    transcriptId: {
      type: Schema.Types.ObjectId,
      ref: 'Transcript',
      default: null,
    },
    notesId: {
      type: Schema.Types.ObjectId,
      ref: 'Notes',
      default: null,
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended', 'failed'],
      default: 'waiting',
    },
    metadata: {
      audioOnly: { type: Boolean, default: false },
      recordingSize: { type: Number, default: null },
      participantCount: { type: Number, default: 1 },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient history queries
callSessionSchema.index({ hostId: 1, createdAt: -1 });
callSessionSchema.index({ guestIds: 1, createdAt: -1 });

export const CallSession = mongoose.model<ICallSession>('CallSession', callSessionSchema);

