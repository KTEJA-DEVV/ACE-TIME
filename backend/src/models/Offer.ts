import mongoose, { Document, Schema } from 'mongoose';

export interface IOffer extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  type: 'product' | 'service' | 'collaboration' | 'investment' | 'other';
  tags: string[];
  targetAudience: string[];
  pricing?: {
    type: 'free' | 'paid' | 'negotiable';
    amount?: number;
    currency?: string;
  };
  visibility: 'private' | 'connections' | 'public' | 'premium_network';
  status: 'draft' | 'active' | 'paused' | 'completed';
  matchCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IOffer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['product', 'service', 'collaboration', 'investment', 'other'],
      default: 'service',
    },
    tags: [String],
    targetAudience: [String],
    pricing: {
      type: { type: String, enum: ['free', 'paid', 'negotiable'] },
      amount: Number,
      currency: { type: String, default: 'USD' },
    },
    visibility: {
      type: String,
      enum: ['private', 'connections', 'public', 'premium_network'],
      default: 'connections',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed'],
      default: 'active',
    },
    matchCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

offerSchema.index({ tags: 1 });
offerSchema.index({ category: 1 });
offerSchema.index({ targetAudience: 1 });

export const Offer = mongoose.model<IOffer>('Offer', offerSchema);

