import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const storyViewSchema = new mongoose.Schema(
  {
    story: { type: ObjectId, ref: 'Story', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

storyViewSchema.index({ story: 1, user: 1 }, { unique: true });
storyViewSchema.index({ user: 1, story: 1 });
storyViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const StoryView = mongoose.model('StoryView', storyViewSchema);
