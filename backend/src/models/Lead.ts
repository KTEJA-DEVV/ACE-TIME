import mongoose, { Document, Schema } from 'mongoose';

export interface ILead extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes: string;
  tags: string[];
  interests: string[];
  matchScore?: number;
  linkedVisionId?: mongoose.Types.ObjectId;
  linkedOfferId?: mongoose.Types.ObjectId;
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: String,
    phone: String,
    company: String,
    role: String,
    source: {
      type: String,
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
      default: 'new',
    },
    notes: {
      type: String,
      default: '',
    },
    tags: [String],
    interests: [String],
    matchScore: Number,
    linkedVisionId: {
      type: Schema.Types.ObjectId,
      ref: 'Vision',
    },
    linkedOfferId: {
      type: Schema.Types.ObjectId,
      ref: 'Offer',
    },
    lastContactedAt: Date,
  },
  {
    timestamps: true,
  }
);

leadSchema.index({ interests: 1 });
leadSchema.index({ tags: 1 });

export const Lead = mongoose.model<ILead>('Lead', leadSchema);

