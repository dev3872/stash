import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const STORY_THEMES = ['sunrise', 'ocean', 'forest', 'ink', 'plum'];
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

const storySchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 220 },
    theme: { type: String, enum: STORY_THEMES, default: 'sunrise' },
    post: { type: ObjectId, ref: 'Post' },
    topic: { type: ObjectId, ref: 'Topic' },
    viewCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB removes a story once `expiresAt` passes. Reads also filter on it,
// because the TTL monitor only runs about once a minute.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ author: 1, expiresAt: -1 });

export const Story = mongoose.model('Story', storySchema);
