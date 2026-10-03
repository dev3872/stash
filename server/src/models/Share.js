import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const shareSchema = new mongoose.Schema(
  {
    post: { type: ObjectId, ref: 'Post', required: true, index: true },
    user: { type: ObjectId, ref: 'User', required: true },
    topic: { type: ObjectId, ref: 'Topic' }, // denormalized for recommendations
  },
  { timestamps: true }
);

shareSchema.index({ user: 1, createdAt: -1 });

export const Share = mongoose.model('Share', shareSchema);
