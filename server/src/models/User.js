import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    auth0Sub: { type: String, required: true, unique: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    picture: { type: String, trim: true },
    followerCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userSchema.index({ followerCount: -1 });

export const User = mongoose.model('User', userSchema);
