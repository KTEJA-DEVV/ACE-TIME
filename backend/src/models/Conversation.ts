import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'direct' | 'group' | 'ai_assisted';
  name?: string;
  participants: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  aiEnabled: boolean;
  aiPersonality?: string;
  linkedCallId?: mongoose.Types.ObjectId;
  lastMessage?: {
    content: string;
    senderId: mongoose.Types.ObjectId;
    timestamp: Date;
  };
  settings: {
    allowPrivateBreakout: boolean;
    aiAutoRespond: boolean;
    aiResponseTrigger: 'always' | 'mention' | 'question';
  };
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group', 'ai_assisted'],
      default: 'direct',
    },
    name: {
      type: String,
      default: null,
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    aiEnabled: {
      type: Boolean,
      default: true,
    },
    aiPersonality: {
      type: String,
      default: 'helpful assistant',
    },
    linkedCallId: {
      type: Schema.Types.ObjectId,
      ref: 'CallSession',
      default: null,
    },
    lastMessage: {
      content: String,
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
      timestamp: Date,
    },
    settings: {
      allowPrivateBreakout: { type: Boolean, default: true },
      aiAutoRespond: { type: Boolean, default: false },
      aiResponseTrigger: { 
        type: String, 
        enum: ['always', 'mention', 'question'],
        default: 'mention',
      },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

