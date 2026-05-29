// ─── identityGenerator.js ────────────────────────────────────────────────────
// Generates anonymous session-scoped identities like Ghost_42 or Shadow_08

const adjectives = [
  'Ghost', 'Shadow', 'Echo', 'Void', 'Cipher', 'Phantom', 'Dusk', 'Neon',
  'Abyss', 'Wraith', 'Specter', 'Glitch', 'Nova', 'Drift', 'Pulse', 'Static',
  'Flicker', 'Sable', 'Mist', 'Rift', 'Surge', 'Ember', 'Haze', 'Veil',
  'Noir', 'Ruin', 'Crest', 'Fray', 'Spark', 'Ash'
];

const generateIdentity = () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const num = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  return `${adj}_${num}`;
};

const generateColor = () => {
  const colors = [
    '#FF2E2E', '#FF6B35', '#F7931E', '#9B59B6',
    '#3498DB', '#1ABC9C', '#E74C3C', '#F39C12',
    '#16A085', '#8E44AD', '#2980B9', '#D35400'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

module.exports = { generateIdentity, generateColor };
