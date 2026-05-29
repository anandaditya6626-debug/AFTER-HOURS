// ─── roomManager.js ──────────────────────────────────────────────────────────
// In-memory room management: create, matchmake, countdown, destroy

const { v4: uuidv4 } = require('uuid');
const { getMultiplePrompts } = require('./promptEngine');

// Room durations by type (in milliseconds)
const ROOM_DURATIONS = {
  deepTalk: 12 * 60 * 1000,    // 12 minutes
  confessions: 8 * 60 * 1000,  // 8 minutes
  chill: 15 * 60 * 1000,       // 15 minutes
  voiceRoom: 10 * 60 * 1000,   // 10 minutes
};

const MAX_USERS = {
  deepTalk: 2,
  confessions: 2,
  chill: 6,
  voiceRoom: 4,
};

// In-memory stores
const rooms = new Map();          // roomId -> room object
const matchmakingQueues = new Map(); // `${roomType}:${mood}:${intent}` -> [socketId, ...]
const userToRoom = new Map();     // socketId -> roomId
const timers = new Map();         // roomId -> timer handle

const createRoom = (roomType, mood, intent) => {
  const roomId = uuidv4();
  const room = {
    id: roomId,
    type: roomType,
    mood,
    intent,
    users: [],           // { socketId, identity, color, peerId }
    messages: [],        // in-memory only
    prompts: getMultiplePrompts(roomType, 5),
    currentPromptIndex: 0,
    createdAt: Date.now(),
    duration: ROOM_DURATIONS[roomType] || 10 * 60 * 1000,
    endsAt: Date.now() + (ROOM_DURATIONS[roomType] || 10 * 60 * 1000),
    isActive: true,
  };
  rooms.set(roomId, room);
  return room;
};

const joinRoom = (roomId, socketId, identity, color, peerId) => {
  const room = rooms.get(roomId);
  if (!room || !room.isActive) return null;
  
  const maxUsers = MAX_USERS[room.type] || 2;
  if (room.users.length >= maxUsers) return null;

  const user = { socketId, identity, color, peerId, joinedAt: Date.now() };
  room.users.push(user);
  userToRoom.set(socketId, roomId);
  return room;
};

const leaveRoom = (socketId) => {
  const roomId = userToRoom.get(socketId);
  if (!roomId) return null;
  
  const room = rooms.get(roomId);
  if (!room) return null;

  room.users = room.users.filter(u => u.socketId !== socketId);
  userToRoom.delete(socketId);
  return { room, roomId };
};

const addMessage = (roomId, message) => {
  const room = rooms.get(roomId);
  if (!room || !room.isActive) return false;
  room.messages.push(message);
  // Cap messages at 200 to prevent memory bloat
  if (room.messages.length > 200) room.messages.shift();
  return true;
};

const destroyRoom = (roomId, io) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Clear timer
  if (timers.has(roomId)) {
    clearTimeout(timers.get(roomId));
    timers.delete(roomId);
  }

  room.isActive = false;

  // Notify all users in room
  if (io) {
    io.to(roomId).emit('session-end', {
      message: 'This moment no longer exists.',
      roomId,
    });
  }

  // Remove all user-to-room mappings for this room
  room.users.forEach(u => userToRoom.delete(u.socketId));

  // Clear room data (erase all memory)
  room.users = [];
  room.messages = [];
  
  // Delete room after brief delay (let clients receive the event)
  setTimeout(() => {
    rooms.delete(roomId);
  }, 3000);
};

const startRoomTimer = (roomId, io) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const duration = room.duration;
  const timer = setTimeout(() => {
    destroyRoom(roomId, io);
  }, duration);

  timers.set(roomId, timer);
};

const getMatchmakingKey = (roomType, mood, intent) => `${roomType}:${mood}:${intent}`;

const findOrCreateRoom = (roomType, mood, intent, socketId, identity, color, peerId) => {
  const maxUsers = MAX_USERS[roomType] || 2;
  
  // Search for an existing room with space
  for (const [id, room] of rooms.entries()) {
    if (
      room.type === roomType &&
      room.mood === mood &&
      room.intent === intent &&
      room.isActive &&
      room.users.length < maxUsers
    ) {
      return { room, isNew: false };
    }
  }

  // Create new room
  const room = createRoom(roomType, mood, intent);
  return { room, isNew: true };
};

const getRoomById = (roomId) => rooms.get(roomId);
const getRoomBySocket = (socketId) => {
  const roomId = userToRoom.get(socketId);
  return roomId ? rooms.get(roomId) : null;
};

const getRoomStats = () => ({
  totalRooms: rooms.size,
  totalUsers: userToRoom.size,
  rooms: [...rooms.values()].map(r => ({
    id: r.id,
    type: r.type,
    userCount: r.users.length,
    isActive: r.isActive,
  }))
});

const getGlobalUserCount = () => userToRoom.size;
const hasTimer = (roomId) => timers.has(roomId);

module.exports = {
  createRoom,
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
};
