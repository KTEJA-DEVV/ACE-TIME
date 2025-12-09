import mongoose, { Document, Schema } from 'mongoose';

export interface IActionItem {
  text: string;
  assignee?: string;
  completed: boolean;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface IDecision {
  decision: string;
  context: string;
  timestamp: string;
}

export interface INoteSection {
  topic: string;
  timestamp: string;
  notes: string[];
  relatedTranscript: string;
}

export interface INotes extends Document {
  _id: mongoose.Types.ObjectId;
  callId: mongoose.Types.ObjectId;
  title: string; // AI-generated meeting title
  date: Date;
  duration: number; // in seconds
  participants: string[];
  summary: string; // 2-3 sentence executive summary
  sections: INoteSection[]; // Organized by topic
  actionItems: IActionItem[];
  decisions: IDecision[];
  keyPoints: string[];
  questionsRaised: string[];
  nextSteps: string[];
  suggestedFollowUp?: Date;
  // Legacy fields for backward compatibility
  bullets: string[];
  suggestedReplies: string[];
  keyTopics: string[];
  generatedAt: Date;
  lastUpdatedAt: Date;
  version: number;
  isEditable: boolean;
  customSections?: Array<{
    title: string;
    content: string;
    order: number;
  }>;
  comments?: Array<{
    userId: string;
    userName: string;
    comment: string;
    timestamp: Date;
  }>;
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
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
  },
  { _id: false }
);

const decisionSchema = new Schema<IDecision>(
  {
    decision: {
      type: String,
      required: true,
    },
    context: {
      type: String,
      default: '',
    },
    timestamp: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const noteSectionSchema = new Schema<INoteSection>(
  {
    topic: {
      type: String,
      required: true,
    },
    timestamp: {
      type: String,
      required: true,
    },
    notes: [{
      type: String,
    }],
    relatedTranscript: {
      type: String,
      default: '',
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
    title: {
      type: String,
      default: 'Meeting Notes',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    duration: {
      type: Number,
      default: 0,
    },
    participants: [{
      type: String,
    }],
    summary: {
      type: String,
      default: '',
    },
    sections: [noteSectionSchema],
    actionItems: [actionItemSchema],
    decisions: [decisionSchema],
    keyPoints: [{
      type: String,
    }],
    questionsRaised: [{
      type: String,
    }],
    nextSteps: [{
      type: String,
    }],
    suggestedFollowUp: {
      type: Date,
      default: null,
    },
    // Legacy fields
    bullets: [{
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
    isEditable: {
      type: Boolean,
      default: true,
    },
    customSections: [{
      title: String,
      content: String,
      order: Number,
    }],
    comments: [{
      userId: Schema.Types.ObjectId,
      userName: String,
      comment: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

export const Notes = mongoose.model<INotes>('Notes', notesSchema);

