import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'ai_response' | 'image' | 'system';
  aiGenerated: boolean;
  aiContext?: string;
  attachments?: Array<{
    type: 'image' | 'file' | 'audio';
    url: string;
    name: string;
  }>;
  reactions?: Array<{
    emoji: string;
    userId: mongoose.Types.ObjectId;
  }>;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'ai_response', 'image', 'system'],
      default: 'text',
    },
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    aiContext: {
      type: String,
      default: null,
    },
    attachments: [{
      type: { type: String, enum: ['image', 'file', 'audio'] },
      url: String,
      name: String,
    }],
    reactions: [{
      emoji: String,
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
    }],
    readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);

