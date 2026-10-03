import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, _id: 1 });

export const Message = mongoose.model('Message', messageSchema);
