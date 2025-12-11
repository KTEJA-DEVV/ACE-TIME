import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

let bucket: GridFSBucket | null = null;

// Initialize GridFS bucket after MongoDB connection
export const initGridFS = () => {
  const db = mongoose.connection.db;
  if (db) {
    bucket = new GridFSBucket(db, { bucketName: 'recordings' });
    console.log('✅ GridFS bucket initialized');
  }
};

export interface UploadResult {
  fileId: string;
  filename: string;
}

// Upload a file buffer to GridFS
export const uploadRecording = async (
  buffer: Buffer,
  filename: string,
  contentType: string,
  metadata: Record<string, any> = {}
): Promise<UploadResult> => {
  if (!bucket) {
    throw new Error('GridFS not initialized');
  }

  return new Promise((resolve, reject) => {
    const readableStream = Readable.from(buffer);
    const uploadStream = bucket!.openUploadStream(filename, {
      contentType,
      metadata,
    });

    readableStream
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        resolve({
          fileId: uploadStream.id.toString(),
          filename: uploadStream.filename,
        });
      });
  });
};

// Get a download stream for a recording
export const getRecordingStream = (fileId: string, start?: number): Readable => {
  if (!bucket) {
    throw new Error('GridFS not initialized');
  }

  // GridFS supports start option for range requests
  const options: { start?: number } = {};
  if (start !== undefined && start > 0) {
    options.start = start;
  }

  return bucket.openDownloadStream(new ObjectId(fileId), options);
};

// Get recording info
export const getRecordingInfo = async (fileId: string) => {
  if (!bucket) {
    throw new Error('GridFS not initialized');
  }

  const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
  return files[0] || null;
};

// Delete a recording
export const deleteRecording = async (fileId: string): Promise<void> => {
  if (!bucket) {
    throw new Error('GridFS not initialized');
  }

  await bucket.delete(new ObjectId(fileId));
};

// List recordings for a call
export const listRecordings = async (callId: string) => {
  if (!bucket) {
    throw new Error('GridFS not initialized');
  }

  return bucket.find({ 'metadata.callId': callId }).toArray();
};

