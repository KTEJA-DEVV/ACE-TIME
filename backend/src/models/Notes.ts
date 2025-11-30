import mongoose, { Document, Schema } from 'mongoose';

export interface IActionItem {
  text: string;
  assignee?: string;
  completed: boolean;
}

export interface INotes extends Document {
  _id: mongoose.Types.ObjectId;
  callId: mongoose.Types.ObjectId;
  summary: string;
  bullets: string[];
  actionItems: IActionItem[];
  decisions: string[];
  suggestedReplies: string[];
  keyTopics: string[];
  generatedAt: Date;
  lastUpdatedAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const actionItemSchema = new Schema<IActionItem>(
  {
    text: {
      type: String,
      required: true,
    },
    assignee: {
      type: String,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const notesSchema = new Schema<INotes>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'CallSession',
      required: true,
      unique: true,
      index: true,
    },
    summary: {
      type: String,
      default: '',
    },
    bullets: [{
      type: String,
    }],
    actionItems: [actionItemSchema],
    decisions: [{
      type: String,
    }],
    suggestedReplies: [{
      type: String,
    }],
    keyTopics: [{
      type: String,
    }],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export const Notes = mongoose.model<INotes>('Notes', notesSchema);

