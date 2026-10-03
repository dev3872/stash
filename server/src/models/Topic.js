import mongoose from 'mongoose';

// `nameKey` is the lower-cased, whitespace-collapsed name. Its unique index is what
// makes topic names unique case-insensitively ("String Theory" === "string theory").
const topicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    postCount: { type: Number, default: 0, min: 0 },
    lastPostedAt: { type: Date },
  },
  { timestamps: true }
);

topicSchema.index({ lastPostedAt: -1 });

export const Topic = mongoose.model('Topic', topicSchema);
