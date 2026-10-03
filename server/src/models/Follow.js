import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const followSchema = new mongoose.Schema(
  {
    follower: { type: ObjectId, ref: 'User', required: true },
    following: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, createdAt: -1 });

export const Follow = mongoose.model('Follow', followSchema);
