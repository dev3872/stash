import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// How far a user has read through one lesson (a source's ordered posts).
const lessonProgressSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    source: { type: ObjectId, ref: 'Source', required: true },
    topic: { type: ObjectId, ref: 'Topic', required: true },
    // Highest bite index the user has reached (0-based).
    furthest: { type: Number, default: 0, min: 0 },
    // Bite index they were last looking at, so "Continue" resumes there.
    current: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

lessonProgressSchema.index({ user: 1, source: 1 }, { unique: true });
lessonProgressSchema.index({ user: 1, updatedAt: -1 });

export const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);
