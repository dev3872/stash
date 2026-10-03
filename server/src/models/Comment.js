import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    post: { type: ObjectId, ref: 'Post', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    topic: { type: ObjectId, ref: 'Topic' }, // denormalized for recommendations
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });
commentSchema.index({ user: 1, createdAt: -1 });

export const Comment = mongoose.model('Comment', commentSchema);
