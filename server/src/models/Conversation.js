import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// A 1:1 conversation. `key` is the two user ids sorted and joined, so there is
// exactly one conversation per pair of people.
const conversationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    participants: [{ type: ObjectId, ref: 'User', required: true }],
    lastMessageText: { type: String, default: '' },
    lastMessageSender: { type: ObjectId, ref: 'User' },
    lastMessageAt: { type: Date },
    // userId -> last time that user opened the conversation
    readAt: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
