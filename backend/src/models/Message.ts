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
  metadata?: {
    originalMessageId?: mongoose.Types.ObjectId;
    originalConversationId?: mongoose.Types.ObjectId;
    groupName?: string;
    isContext?: boolean;
    isPrivateReply?: boolean;
  };
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
      enum: ['text', 'ai_response', 'image', 'system', 'call_summary', 'call_transcript', 'ai_notes'],
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
      type: { type: String, enum: ['image', 'file', 'audio', 'video', 'call_recording'] },
      url: String,
      name: String,
      size: Number,
      duration: Number, // For audio/video files
    }],
    reactions: [{
      emoji: String,
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
    }],
    readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    metadata: {
      originalMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      originalConversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
      groupName: String,
      isContext: Boolean,
      isPrivateReply: Boolean,
      // Call-related metadata
      callId: { type: Schema.Types.ObjectId, ref: 'CallSession' },
      callDuration: Number,
      callRecordingUrl: String,
      transcriptId: { type: Schema.Types.ObjectId, ref: 'Transcript' },
      notesId: { type: Schema.Types.ObjectId, ref: 'Notes' },
      // AI notes metadata
      aiSummary: String,
      aiActionItems: [{ text: String, assignee: String }],
      aiDecisions: [String],
      aiKeyTopics: [String],
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);

