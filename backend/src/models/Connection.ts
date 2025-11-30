import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  connectedUserId: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'blocked';
  mutualConnections: mongoose.Types.ObjectId[];
  sharedInterests: string[];
  connectionStrength: number;
  lastInteractionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema<IConnection>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    connectedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending',
    },
    mutualConnections: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    sharedInterests: [String],
    connectionStrength: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastInteractionAt: Date,
  },
  {
    timestamps: true,
  }
);

connectionSchema.index({ userId: 1, connectedUserId: 1 }, { unique: true });
connectionSchema.index({ userId: 1, status: 1 });

export const Connection = mongoose.model<IConnection>('Connection', connectionSchema);

