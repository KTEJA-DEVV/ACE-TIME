import mongoose, { Document, Schema } from 'mongoose';

export interface IGeneratedImage extends Document {
  _id: mongoose.Types.ObjectId;
  callId?: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  prompt: string;
  revisedPrompt?: string;
  imageUrl: string;
  imageKey?: string;
  style: 'realistic' | 'artistic' | 'sketch' | 'dream' | 'abstract';
  contextSource: 'call_transcript' | 'chat' | 'manual';
  transcriptContext?: string;
  likes: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const generatedImageSchema = new Schema<IGeneratedImage>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'CallSession',
      default: null,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    revisedPrompt: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageKey: {
      type: String,
      default: null,
    },
    style: {
      type: String,
      enum: ['realistic', 'artistic', 'sketch', 'dream', 'abstract'],
      default: 'dream',
    },
    contextSource: {
      type: String,
      enum: ['call_transcript', 'chat', 'manual'],
      default: 'manual',
    },
    transcriptContext: {
      type: String,
      default: null,
    },
    likes: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  {
    timestamps: true,
  }
);

generatedImageSchema.index({ callId: 1, createdAt: -1 });
generatedImageSchema.index({ creatorId: 1, createdAt: -1 });

export const GeneratedImage = mongoose.model<IGeneratedImage>('GeneratedImage', generatedImageSchema);

