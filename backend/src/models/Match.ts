import mongoose, { Document, Schema } from 'mongoose';

export interface IMatch extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'lead_offer' | 'vision_vision' | 'user_user' | 'mutual_connection';
  initiatorId: mongoose.Types.ObjectId;
  targetId: mongoose.Types.ObjectId;
  sourceEntityType: 'vision' | 'offer' | 'lead' | 'user';
  sourceEntityId: mongoose.Types.ObjectId;
  targetEntityType: 'vision' | 'offer' | 'lead' | 'user';
  targetEntityId: mongoose.Types.ObjectId;
  matchScore: number;
  matchReasons: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  mutualConnectionIds?: mongoose.Types.ObjectId[];
  aiInsights?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const matchSchema = new Schema<IMatch>(
  {
    type: {
      type: String,
      enum: ['lead_offer', 'vision_vision', 'user_user', 'mutual_connection'],
      required: true,
    },
    initiatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sourceEntityType: {
      type: String,
      enum: ['vision', 'offer', 'lead', 'user'],
      required: true,
    },
    sourceEntityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    targetEntityType: {
      type: String,
      enum: ['vision', 'offer', 'lead', 'user'],
      required: true,
    },
    targetEntityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    matchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    matchReasons: [String],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    mutualConnectionIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    aiInsights: String,
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

matchSchema.index({ initiatorId: 1, status: 1 });
matchSchema.index({ targetId: 1, status: 1 });
matchSchema.index({ matchScore: -1 });

export const Match = mongoose.model<IMatch>('Match', matchSchema);

