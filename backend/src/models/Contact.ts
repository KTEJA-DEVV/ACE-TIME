import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Owner of this contact list
  contactUserId: mongoose.Types.ObjectId; // The contact person
  conversationId: mongoose.Types.ObjectId; // Linked conversation/thread
  nickname?: string; // Custom nickname for the contact
  tags: string[]; // User-defined tags
  notes?: string; // Personal notes about the contact
  lastInteractionAt?: Date; // Last message or call timestamp
  totalMessages: number; // Total message count
  totalCalls: number; // Total call count
  unreadCount: number; // Unread messages count
  isPinned: boolean; // Pinned to top
  isArchived: boolean; // Archived contact
  isBlocked: boolean; // Blocked contact
  aiContext?: {
    // AI-generated context about this contact
    summary?: string;
    keyTopics?: string[];
    relationship?: string; // e.g., "colleague", "friend", "client"
    lastUpdated?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      unique: true,
      index: true,
    },
    nickname: {
      type: String,
      default: null,
    },
    tags: [{
      type: String,
    }],
    notes: {
      type: String,
      default: null,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    totalMessages: {
      type: Number,
      default: 0,
    },
    totalCalls: {
      type: Number,
      default: 0,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    aiContext: {
      summary: String,
      keyTopics: [String],
      relationship: String,
      lastUpdated: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
contactSchema.index({ userId: 1, isArchived: 1, lastInteractionAt: -1 });
contactSchema.index({ userId: 1, isPinned: -1, lastInteractionAt: -1 });
contactSchema.index({ userId: 1, contactUserId: 1 }, { unique: true });

// Ensure one contact entry per user-contact pair
contactSchema.index(
  { userId: 1, contactUserId: 1 },
  { unique: true, name: 'contact_unique_idx' }
);

export const Contact = mongoose.model<IContact>('Contact', contactSchema);

