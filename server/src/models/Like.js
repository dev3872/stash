import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const likeSchema = new mongoose.Schema(
  {
    post: { type: ObjectId, ref: 'Post', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    topic: { type: ObjectId, ref: 'Topic' }, // denormalized for recommendations
  },
  { timestamps: true }
);

likeSchema.index({ post: 1, user: 1 }, { unique: true });
likeSchema.index({ user: 1, createdAt: -1 });
likeSchema.index({ topic: 1, createdAt: -1 });

export const Like = mongoose.model('Like', likeSchema);
