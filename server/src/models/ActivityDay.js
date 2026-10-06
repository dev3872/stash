import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// One row per user per local calendar day they read at least one new bite.
// `day` is YYYY-MM-DD in the user's own time zone; it drives streaks and the daily goal.
const activityDaySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    bites: { type: Number, default: 0, min: 0 },
    lessonsCompleted: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

activityDaySchema.index({ user: 1, day: -1 }, { unique: true });

export const ActivityDay = mongoose.model('ActivityDay', activityDaySchema);
