import mongoose, { Document, Schema } from 'mongoose';

export interface IVision extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  tags: string[];
  visibility: 'private' | 'connections' | 'public';
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const visionSchema = new Schema<IVision>(
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
    tags: [{
      type: String,
    }],
    visibility: {
      type: String,
      enum: ['private', 'connections', 'public'],
      default: 'connections',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

visionSchema.index({ tags: 1 });
visionSchema.index({ category: 1 });

export const Vision = mongoose.model<IVision>('Vision', visionSchema);

