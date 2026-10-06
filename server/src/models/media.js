import mongoose from 'mongoose';

// A picture, animation or short video shown on a bite, with its attribution.
export const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['image', 'animation', 'video'], required: true },
    url: { type: String, required: true, maxlength: 2000 },
    poster: { type: String, maxlength: 2000 },
    mime: { type: String, maxlength: 40 },
    width: { type: Number },
    height: { type: Number },
    caption: { type: String, maxlength: 300 },
    credit: { type: String, maxlength: 120 },
    license: { type: String, maxlength: 80 },
    pageUrl: { type: String, maxlength: 2000 },
  },
  { _id: false }
);
