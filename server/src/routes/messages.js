import { Router } from 'express';
import { Conversation, Message, User } from '../models/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { isObjectId, parseLimit, requireObjectId, requireText } from '../lib/validate.js';
import { publicUser } from '../services/users.js';

const conversationKey = (a, b) => [String(a), String(b)].sort().join(':');

function readAtFor(conversation, userId) {
  const map = conversation.readAt;
  const value = map instanceof Map ? map.get(String(userId)) : map?.[String(userId)];
  return value ? new Date(value) : null;
}

function isUnread(conversation, userId) {
  if (!conversation.lastMessageAt || String(conversation.lastMessageSender) === String(userId)) return false;
  const readAt = readAtFor(conversation, userId);
  return !readAt || readAt < new Date(conversation.lastMessageAt);
}

function serializeConversation(conversation, viewer) {
  const other = conversation.participants.find((p) => String(p?._id ?? p) !== String(viewer._id));
  return {
    id: String(conversation._id),
    other: publicUser(other && other._id ? other : null),
    lastMessage: conversation.lastMessageAt
      ? {
        text: conversation.lastMessageText,
        at: conversation.lastMessageAt,
        fromMe: String(conversation.lastMessageSender) === String(viewer._id),
      }
      : null,
    unread: isUnread(conversation, viewer._id),
    createdAt: conversation.createdAt,
  };
}

function serializeMessage(message, viewer) {
  return {
    id: String(message._id),
    text: message.text,
    createdAt: message.createdAt,
    senderId: String(message.sender),
    fromMe: String(message.sender) === String(viewer._id),
  };
}

async function findMembership(id, viewer) {
  const conversation = await Conversation.findOne({ _id: requireObjectId(id, 'Conversation'), participants: viewer._id })
    .populate('participants', 'name picture');
  if (!conversation) throw notFound('Conversation not found.');
  return conversation;
}

export function messageRoutes({ requireAuth }) {
  const router = Router();

  router.get('/conversations', requireAuth, async (req, res) => {
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(100)
      .populate('participants', 'name picture')
      .lean();
    res.json({
      conversations: conversations
        .filter((c) => c.lastMessageAt)
        .map((c) => serializeConversation(c, req.user)),
    });
  });

  router.get('/conversations/unread', requireAuth, async (req, res) => {
    const conversations = await Conversation.find({ participants: req.user._id, lastMessageAt: { $ne: null } })
      .select('lastMessageAt lastMessageSender readAt')
      .lean();
    res.json({ count: conversations.filter((c) => isUnread(c, req.user._id)).length });
  });

  // Opens (or creates) the 1:1 conversation with another user.
  router.post('/conversations', requireAuth, async (req, res) => {
    const userId = req.body?.userId;
    if (!isObjectId(userId)) throw badRequest('Choose someone to message.');
    if (userId === String(req.user._id)) throw badRequest("You can't message yourself.");
    const other = await User.findById(userId).select('_id');
    if (!other) throw notFound('User not found.');

    const key = conversationKey(req.user._id, other._id);
    let conversation = await Conversation.findOne({ key });
    if (!conversation) {
      try {
        conversation = await Conversation.create({ key, participants: [req.user._id, other._id] });
      } catch (err) {
        if (err?.code !== 11000) throw err;
        conversation = await Conversation.findOne({ key });
      }
    }
    await conversation.populate('participants', 'name picture');
    res.status(201).json({ conversation: serializeConversation(conversation, req.user) });
  });

  router.get('/conversations/:id', requireAuth, async (req, res) => {
    const conversation = await findMembership(req.params.id, req.user);
    res.json({ conversation: serializeConversation(conversation, req.user) });
  });

  // ?after=<messageId> returns newer messages (polling); ?before=<messageId> pages back.
  router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
    const conversation = await findMembership(req.params.id, req.user);
    const limit = parseLimit(req.query.limit, { fallback: 50, max: 100 });
    const { after, before } = req.query;
    const query = { conversation: conversation._id };

    if (after) {
      if (!isObjectId(String(after))) throw badRequest('after must be a message id.');
      query._id = { $gt: after };
      const messages = await Message.find(query).sort({ _id: 1 }).limit(limit).lean();
      return res.json({ messages: messages.map((m) => serializeMessage(m, req.user)), hasMore: false });
    }

    if (before) {
      if (!isObjectId(String(before))) throw badRequest('before must be a message id.');
      query._id = { $lt: before };
    }
    const messages = await Message.find(query).sort({ _id: -1 }).limit(limit + 1).lean();
    const hasMore = messages.length > limit;
    res.json({ messages: messages.slice(0, limit).reverse().map((m) => serializeMessage(m, req.user)), hasMore });
  });

  router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
    const text = requireText(req.body?.text, { field: 'Message', min: 1, max: 1000 });
    const conversation = await findMembership(req.params.id, req.user);
    const message = await Message.create({ conversation: conversation._id, sender: req.user._id, text });
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageText: text.slice(0, 140),
          lastMessageSender: req.user._id,
          lastMessageAt: message.createdAt,
          [`readAt.${req.user._id}`]: message.createdAt,
        },
      }
    );
    res.status(201).json({ message: serializeMessage(message, req.user) });
  });

  router.post('/conversations/:id/read', requireAuth, async (req, res) => {
    const conversation = await findMembership(req.params.id, req.user);
    await Conversation.updateOne({ _id: conversation._id }, { $set: { [`readAt.${req.user._id}`]: new Date() } });
    res.json({ read: true });
  });

  return router;
}
