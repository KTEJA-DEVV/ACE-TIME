import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  bio?: string;
  settings: {
    // Profile
    defaultMic: boolean;
    defaultCamera: boolean;
    autoRecord: boolean;
    // Notifications
    notifications: {
      incomingCalls: boolean;
      newMessages: boolean;
      friendRequests: boolean;
      aiInsights: boolean;
      callRecordings: boolean;
    };
    // Call Quality
    callQuality: {
      videoResolution: '720p' | '1080p' | 'auto';
      bandwidth: 'low' | 'medium' | 'high' | 'auto';
      audioQuality: 'low' | 'medium' | 'high';
    };
    // AI Settings
    ai: {
      enabled: boolean;
      voicePreference: 'male' | 'female' | 'neutral';
      autoTranscribe: boolean;
      autoSummarize: boolean;
    };
    // Privacy
    privacy: {
      whoCanCall: 'everyone' | 'contacts' | 'nobody';
      chatHistory: 'forever' | '30days' | '7days' | 'delete';
      profileVisibility: 'public' | 'contacts' | 'private';
    };
    // Appearance
    appearance: {
      theme: 'dark' | 'light' | 'auto';
      accentColor: 'purple' | 'blue' | 'green' | 'red' | 'orange';
    };
  };
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: null,
    },
    settings: {
      defaultMic: { type: Boolean, default: true },
      defaultCamera: { type: Boolean, default: true },
      autoRecord: { type: Boolean, default: true },
      notifications: {
        incomingCalls: { type: Boolean, default: true },
        newMessages: { type: Boolean, default: true },
        friendRequests: { type: Boolean, default: true },
        aiInsights: { type: Boolean, default: true },
        callRecordings: { type: Boolean, default: true },
      },
      callQuality: {
        videoResolution: { type: String, enum: ['720p', '1080p', 'auto'], default: 'auto' },
        bandwidth: { type: String, enum: ['low', 'medium', 'high', 'auto'], default: 'auto' },
        audioQuality: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
      },
      ai: {
        enabled: { type: Boolean, default: true },
        voicePreference: { type: String, enum: ['male', 'female', 'neutral'], default: 'neutral' },
        autoTranscribe: { type: Boolean, default: true },
        autoSummarize: { type: Boolean, default: true },
      },
      privacy: {
        whoCanCall: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
        chatHistory: { type: String, enum: ['forever', '30days', '7days', 'delete'], default: 'forever' },
        profileVisibility: { type: String, enum: ['public', 'contacts', 'private'], default: 'public' },
      },
      appearance: {
        theme: { type: String, enum: ['dark', 'light', 'auto'], default: 'dark' },
        accentColor: { type: String, enum: ['purple', 'blue', 'green', 'red', 'orange'], default: 'purple' },
      },
    },
    refreshToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Remove sensitive data when converting to JSON
userSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    const { passwordHash, refreshToken, __v, ...rest } = ret;
    return rest;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);

