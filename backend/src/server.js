// ─── server.js ───────────────────────────────────────────────────────────────
// AfterHours Backend — Express + Socket.io (no PeerJS server, WebRTC is client-side)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { generateIdentity, generateColor } = require('./identityGenerator');
const { getPrompt } = require('./promptEngine');
const {
  joinRoom,
  leaveRoom,
  addMessage,
  destroyRoom,
  startRoomTimer,
  findOrCreateRoom,
  getRoomById,
  getRoomBySocket,
  getRoomStats,
  getGlobalUserCount,
  hasTimer,
} = require('./roomManager');

const PORT = process.env.PORT || 3002;
const isDev = process.env.NODE_ENV !== 'production';

const corsOrigin = isDev
  ? true  // accept ALL origins in dev
  : (process.env.FRONTEND_URL || 'http://localhost:3000');

const app = express();
const server = http.createServer(app);

// Reflect the request origin (required for credentials:true — can't use wildcard)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow all in dev, or if no origin (curl/server-side)
    callback(null, origin || '*');
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes
app.use(express.json());

// ─── REST Routes ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'alive', users: getGlobalUserCount() }));
app.get('/stats', (_, res) => res.json(getRoomStats()));
app.get('/online', (_, res) => res.json({ count: getGlobalUserCount() }));

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, origin || true),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Broadcast global user count every 5s
setInterval(() => {
  io.emit('global-count', { count: getGlobalUserCount() });
}, 5000);

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── Generate identity ──────────────────────────────────────────────────────
  socket.on('generate-identity', (_, callback) => {
    const identity = generateIdentity();
    const color = generateColor();
    if (typeof callback === 'function') callback({ identity, color });
  });

  // ── Matchmaking ────────────────────────────────────────────────────────────
  socket.on('find-room', ({ roomType, mood, intent, identity, color, peerId }) => {
    try {
      // Leave any existing room first
      const existingRoom = getRoomBySocket(socket.id);
      if (existingRoom) handleLeave(socket, existingRoom.id);

      const { room, isNew } = findOrCreateRoom(roomType, mood, intent, socket.id, identity, color, peerId);
      const joinedRoom = joinRoom(room.id, socket.id, identity, color, peerId);

      if (!joinedRoom) {
        socket.emit('error', { message: 'Failed to join room.' });
        return;
      }

      socket.join(room.id);

      socket.emit('room-joined', {
        roomId: room.id,
        roomType: room.type,
        mood: room.mood,
        intent: room.intent,
        users: room.users,
        prompts: room.prompts,
        endsAt: room.endsAt,
        duration: room.duration,
        identity,
        color,
      });

      socket.to(room.id).emit('user-joined', {
        socketId: socket.id,
        identity,
        color,
        peerId,
        users: room.users,
      });

      io.to(room.id).emit('system-message', {
        text: room.users.length === 1
          ? 'Waiting for a stranger...'
          : `${identity} has entered the room.`,
        type: 'join',
      });

      // Start timer when 2+ users
      if (room.users.length >= 2) {
        if (!hasTimer(room.id)) {
          startRoomTimer(room.id, io);
          io.to(room.id).emit('system-message', {
            text: "You've been matched. The session has begun.",
            type: 'matched',
          });
        }
      } else {
        // Solo: start after 60s if still alone
        setTimeout(() => {
          const r = getRoomById(room.id);
          if (r && r.isActive && !hasTimer(room.id)) {
            startRoomTimer(room.id, io);
            io.to(room.id).emit('system-message', {
              text: 'No one else arrived. The room is yours.',
              type: 'solo',
            });
          }
        }, 60000);
      }

      console.log(`[Room] ${socket.id}(${identity}) joined ${room.id} [${room.type}] (${room.users.length} users)`);
    } catch (err) {
      console.error('[find-room error]', err);
      socket.emit('error', { message: 'Matchmaking failed. Please try again.' });
    }
  });

  // ── Chat ───────────────────────────────────────────────────────────────────
  socket.on('chat-message', ({ roomId, text, identity, color }) => {
    const room = getRoomById(roomId);
    if (!room || !room.isActive) return;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      socketId: socket.id,
      identity,
      color,
      text: text?.trim()?.substring(0, 500) || '',
      timestamp: Date.now(),
    };

    if (!message.text) return;
    addMessage(roomId, message);
    io.to(roomId).emit('chat-message', message);
  });

  // ── Typing ─────────────────────────────────────────────────────────────────
  socket.on('typing-start', ({ roomId, identity }) => {
    socket.to(roomId).emit('typing-start', { socketId: socket.id, identity });
  });

  socket.on('typing-stop', ({ roomId }) => {
    socket.to(roomId).emit('typing-stop', { socketId: socket.id });
  });

  // ── WebRTC relay ───────────────────────────────────────────────────────────
  socket.on('peer-signal', ({ to, signal, from, identity }) => {
    io.to(to).emit('peer-signal', { from: socket.id, signal, identity });
  });

  // ── Get current room state (called by room page on mount) ──────────────────
  socket.on('get-room', ({ roomId }) => {
    const room = getRoomById(roomId);
    if (!room || !room.isActive) {
      socket.emit('error', { message: 'Room not found.' });
      return;
    }
    const user = room.users.find(u => u.socketId === socket.id);
    if (!user) {
      socket.emit('error', { message: 'You are not in this room.' });
      return;
    }
    socket.emit('room-joined', {
      roomId: room.id,
      roomType: room.type,
      mood: room.mood,
      intent: room.intent,
      users: room.users,
      prompts: room.prompts,
      endsAt: room.endsAt,
      duration: room.duration,
      identity: user.identity,
      color: user.color,
    });
  });

  // ── New prompt ─────────────────────────────────────────────────────────────
  socket.on('request-prompt', ({ roomId, roomType }) => {
    const room = getRoomById(roomId);
    if (!room || !room.isActive) return;
    const prompt = getPrompt(roomType);
    io.to(roomId).emit('new-prompt', { prompt, requestedBy: socket.id });
  });

  // ── Report ─────────────────────────────────────────────────────────────────
  socket.on('report-user', ({ roomId, targetSocketId, reason }) => {
    console.warn(`[REPORT] ${socket.id} reported ${targetSocketId} in ${roomId}: ${reason}`);
    socket.emit('report-received', { message: 'Report submitted.' });
    if (targetSocketId) {
      io.to(targetSocketId).emit('system-message', {
        text: 'Your behavior has been flagged.',
        type: 'warning',
      });
    }
  });

  // ── Leave ──────────────────────────────────────────────────────────────────
  socket.on('leave-room', ({ roomId }) => handleLeave(socket, roomId));

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket.id);
    if (room) handleLeave(socket, room.id);
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });

  function handleLeave(socket, roomId) {
    const result = leaveRoom(socket.id);
    if (!result) return;

    socket.leave(roomId);
    const { room } = result;
    const user = room.users.find(u => u.socketId === socket.id);
    const name = user?.identity || 'Someone';

    io.to(roomId).emit('user-left', { socketId: socket.id, identity: name, users: room.users });
    io.to(roomId).emit('system-message', { text: `${name} has left.`, type: 'leave' });

    if (room.users.length === 0) destroyRoom(roomId, io);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════╗
║     AfterHours Backend Online        ║
║     Port: ${PORT}                       ║
║     "When the world sleeps..."       ║
╚══════════════════════════════════════╝
  `);
});
