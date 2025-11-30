import mongoose, { Document, Schema } from 'mongoose';

export interface ITranscriptSegment {
  speaker: string;
  speakerId?: mongoose.Types.ObjectId;
  text: string;
  timestamp: number; // seconds from call start
  confidence?: number;
}

export interface ITranscript extends Document {
  _id: mongoose.Types.ObjectId;
  callId: mongoose.Types.ObjectId;
  segments: ITranscriptSegment[];
  fullText: string;
  language: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const transcriptSegmentSchema = new Schema<ITranscriptSegment>(
  {
    speaker: {
      type: String,
      required: true,
    },
    speakerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    confidence: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const transcriptSchema = new Schema<ITranscript>(
  {
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'CallSession',
      required: true,
      unique: true,
      index: true,
    },
    segments: [transcriptSegmentSchema],
    fullText: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'en',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Update fullText and wordCount when segments change
transcriptSchema.pre('save', function (next) {
  if (this.isModified('segments')) {
    this.fullText = this.segments.map(s => `${s.speaker}: ${s.text}`).join('\n');
    this.wordCount = this.fullText.split(/\s+/).filter(w => w.length > 0).length;
  }
  next();
});

// Text search index for searching transcripts
transcriptSchema.index({ fullText: 'text' });

export const Transcript = mongoose.model<ITranscript>('Transcript', transcriptSchema);

