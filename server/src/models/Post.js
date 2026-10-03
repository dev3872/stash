import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const postSchema = new mongoose.Schema(
  {
    topic: { type: ObjectId, ref: 'Topic', required: true },
    source: { type: ObjectId, ref: 'Source', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 1200 },
    example: { type: String, trim: true, maxlength: 600 },
    order: { type: Number, required: true, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Feed order: newest sequence first (source ids are time-ordered), posts in order inside it.
postSchema.index({ source: -1, order: 1 });
postSchema.index({ topic: 1, source: -1, order: 1 });
postSchema.index({ author: 1, source: -1, order: 1 });

export const Post = mongoose.model('Post', postSchema);
