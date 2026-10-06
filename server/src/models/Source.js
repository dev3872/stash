import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const sourceSchema = new mongoose.Schema(
  {
    topic: { type: ObjectId, ref: 'Topic', required: true, index: true },
    author: { type: ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['pdf', 'url'], required: true },
    url: { type: String },
    filePath: { type: String },
    originalName: { type: String },
    title: { type: String, maxlength: 300 },
    extractedText: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending', index: true },
    error: { type: String },
    converter: { type: String, enum: ['openai', 'local'] },
    // 'topic' when the learner gave only a topic name and Stash found a Wikipedia article.
    origin: { type: String, enum: ['upload', 'link', 'topic'] },
    wikiTitle: { type: String, maxlength: 300 },
    mediaCheckedAt: { type: Date },
    postCount: { type: Number, default: 0, min: 0 },
    // Engagement totals across the sequence, used by the recommender.
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const Source = mongoose.model('Source', sourceSchema);
