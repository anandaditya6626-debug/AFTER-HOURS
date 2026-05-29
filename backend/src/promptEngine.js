// ─── promptEngine.js ─────────────────────────────────────────────────────────
// Manages conversation prompts per room type

const prompts = {
  deepTalk: [
    "What's something you've never told anyone?",
    "What are you feeling right now, honestly?",
    "What keeps you awake at night?",
    "If you could restart one thing in your life, what would it be?",
    "What does loneliness feel like to you?",
    "What's a belief you hold that most people would disagree with?",
    "When did you last feel truly understood?",
    "What are you running from right now?",
    "What's the version of yourself you're afraid to be?",
    "What would you say to yourself from 5 years ago?",
  ],
  confessions: [
    "Tell me something you've never said out loud.",
    "What's a secret you've been carrying too long?",
    "What's something you did that you're not proud of?",
    "What do you pretend doesn't bother you?",
    "What's a lie you tell yourself every day?",
    "What do you want but are afraid to admit?",
    "Who hurt you most without knowing it?",
    "What would you confess if there were zero consequences?",
    "What's the thing you want most but haven't pursued?",
    "What's a part of yourself you hide from everyone?",
  ],
  chill: [
    "What's the last song that genuinely moved you?",
    "If tonight were a movie, what genre would it be?",
    "What's your comfort thing when the world feels heavy?",
    "Random fact that lives in your head rent-free?",
    "What's something small that made you smile recently?",
    "What would your perfect midnight look like?",
    "What's a place you want to disappear to?",
    "What are you obsessing over lately?",
    "What's your relationship with silence?",
    "If you could be anywhere right now, where would you be?",
  ],
  voiceRoom: [
    "Just breathe. What's on your mind?",
    "Say something real. Anything.",
    "What do you sound like when no one's listening?",
    "Read the room — what does the silence feel like?",
    "What's a sound that makes you feel safe?",
    "Talk about something you love passionately.",
    "What's a voice you miss hearing?",
    "If music could describe your current mood, what would it be?",
  ]
};

const getPrompt = (roomType) => {
  const key = roomType || 'deepTalk';
  const list = prompts[key] || prompts.deepTalk;
  return list[Math.floor(Math.random() * list.length)];
};

const getMultiplePrompts = (roomType, count = 3) => {
  const key = roomType || 'deepTalk';
  const list = [...(prompts[key] || prompts.deepTalk)];
  const shuffled = list.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

module.exports = { getPrompt, getMultiplePrompts, prompts };
