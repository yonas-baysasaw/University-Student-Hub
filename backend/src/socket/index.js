import { Server } from 'socket.io';
import { ENV } from '../config/env.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import {
  getOnlineUsers,
  markOffline,
  markOnline,
} from '../services/presenceService.js';
import { authenticateSocket } from './middleware/jwt.js';

const _getMemberIds = (chat) => chat.members.map((member) => member.toString());

const shouldJoinChat = (chat, userId) => {
  return chat?.members?.some((member) => member.toString() === userId);
};

const sanitizeMessage = (message) => ({
  ...message.toObject(),
  id: message._id,
});

let io;

export const initSocketServer = async (server, sessionMiddleware) => {
  io = new Server(server, {
    cors: {
      origin: ENV.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  if (sessionMiddleware) {
    io.use((socket, next) => {
      const req = socket.request;
      const res = req.res || {
        getHeader: () => undefined,
        setHeader: () => undefined,
        writeHead: () => undefined,
      };
      sessionMiddleware(req, res, next);
    });
  }

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { user } = socket;

    (async () => {
      try {
        await markOnline(user.id);
        const onlineUsers = await getOnlineUsers();
        socket.emit('onlineUsers', onlineUsers);
        io.emit('userOnline', { userId: user.id });
      } catch (error) {
        console.error('Failed to update presence on connect', error);
      }
    })();

    socket.on('joinChats', async ({ chatIds } = {}) => {
      try {
        if (!Array.isArray(chatIds)) {
          return;
        }

        const chats = await Chat.find(
          { _id: { $in: chatIds }, members: user._id },
          '_id',
        );
        for (const chat of chats) {
          socket.join(chat.id);
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('joinChat', async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId).select('members');
        if (!shouldJoinChat(chat, user.id)) {
          return;
        }

        await socket.join(chatId);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('leaveChat', ({ chatId }) => {
      if (chatId) {
        socket.leave(chatId);
      }
    });

    socket.on(
      'sendMessage',
      async ({ chatId, content, messageType = 'text', fileUrl }) => {
        try {
          if (!chatId) {
            throw new Error('Chat id is required');
          }

          const chat = await Chat.findById(chatId).select('members');
          if (!shouldJoinChat(chat, user.id)) {
            throw new Error('You are not a member of this chat');
          }

          const message = await Message.create({
            chat: chatId,
            sender: user._id,
            content,
            messageType,
            fileUrl,
            readBy: [user._id],
          });

          chat.lastMessage = message._id;
          await chat.save();

          const populated = await message.populate(
            'sender',
            'username email avatar photo',
          );
          io.to(chatId).emit('message', sanitizeMessage(populated));
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      },
    );

    socket.on('typing', ({ chatId }) => {
      if (!chatId) {
        return;
      }

      socket.to(chatId).emit('typing', {
        chatId,
        user: {
          id: user.id,
          username: user.username,
        },
      });
    });

    socket.on('stopTyping', ({ chatId }) => {
      if (!chatId) {
        return;
      }

      socket.to(chatId).emit('stopTyping', { chatId, userId: user.id });
    });

    socket.on('markAsRead', async ({ chatId }) => {
      try {
        if (!chatId) {
          throw new Error('Chat id is required');
        }

        await Message.updateMany(
          { chat: chatId, readBy: { $ne: user._id } },
          { $addToSet: { readBy: user._id } },
        );

        io.to(chatId).emit('readReceipt', {
          chatId,
          userId: user.id,
          timestamp: new Date(),
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', async () => {
      try {
        await markOffline(user.id);
        await User.findByIdAndUpdate(user._id, { lastSeen: new Date() });
        const onlineUsers = await getOnlineUsers();
        io.emit('userOffline', { userId: user.id, onlineUsers });
      } catch (error) {
        console.error('Error handling socket disconnect', error);
      }
    });
  });

  return io;
};
