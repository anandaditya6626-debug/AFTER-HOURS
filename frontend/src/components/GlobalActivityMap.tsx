'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface RadarNode {
  id: number;
  x: number;
  y: number;
  room: string;
  count: number;
  pulseDelay: number;
  size: number;
}

const ROOM_LABELS = ['VOID', 'CONFESSIONS', 'DEEP TALK', 'CHILL', 'VOICE', 'HIDDEN', 'UNKNOWN'];

export const GlobalActivityMap = ({ visible = false, onClose }: { visible: boolean; onClose: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [nodes, setNodes] = useState<RadarNode[]>([]);
  const [totalEntities, setTotalEntities] = useState(0);
  const [strongestSignal, setStrongestSignal] = useState('VOID');

  // Generate nodes
  useEffect(() => {
    if (!visible) return;

    const generated: RadarNode[] = Array.from({ length: 12 + Math.floor(Math.random() * 8) }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.15 + Math.random() * 0.35;
      return {
        id: i,
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius,
        room: ROOM_LABELS[Math.floor(Math.random() * ROOM_LABELS.length)],
        count: 1 + Math.floor(Math.random() * 25),
        pulseDelay: Math.random() * 3,
        size: 2 + Math.random() * 4,
      };
    });

    setNodes(generated);
    setTotalEntities(generated.reduce((sum, n) => sum + n.count, 0) + 80 + Math.floor(Math.random() * 100));

    const rooms = generated.reduce((acc, n) => {
      acc[n.room] = (acc[n.room] || 0) + n.count;
      return acc;
    }, {} as Record<string, number>);
    const strongest = Object.entries(rooms).sort((a, b) => b[1] - a[1])[0];
    if (strongest) setStrongestSignal(strongest[0]);
  }, [visible]);

  // Radar sweep animation
  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.42;

    const render = (time: number) => {
      ctx.clearRect(0, 0, size, size);

      // Background circles
      ctx.strokeStyle = 'rgba(255,46,46,0.06)';
      ctx.lineWidth = 0.5;
      for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * (r / 4), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
      ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
      ctx.stroke();

      // Sweep line
      const sweepAngle = (time / 3000) % (Math.PI * 2);
      const sweepX = cx + Math.cos(sweepAngle) * maxR;
      const sweepY = cy + Math.sin(sweepAngle) * maxR;

      const gradient = ctx.createLinearGradient(cx, cy, sweepX, sweepY);
      gradient.addColorStop(0, 'rgba(255,46,46,0.3)');
      gradient.addColorStop(1, 'rgba(255,46,46,0)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Sweep trail (wedge)
      ctx.fillStyle = 'rgba(255,46,46,0.03)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, sweepAngle - 0.5, sweepAngle, false);
      ctx.closePath();
      ctx.fill();

      // Nodes
      nodes.forEach(node => {
        const nx = cx + (node.x - 0.5) * 2 * maxR;
        const ny = cy + (node.y - 0.5) * 2 * maxR;

        // Pulse ring
        const pulsePhase = ((time / 1000 + node.pulseDelay) % 2) / 2;
        const pulseRadius = node.size + pulsePhase * 12;
        const pulseAlpha = 0.3 * (1 - pulsePhase);

        ctx.strokeStyle = `rgba(255,46,46,${pulseAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(nx, ny, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Node dot
        ctx.fillStyle = `rgba(255,46,46,${0.4 + Math.sin(time / 500 + node.id) * 0.2})`;
        ctx.beginPath();
        ctx.arc(nx, ny, node.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Center dot
      ctx.fillStyle = 'rgba(255,46,46,0.6)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible, nodes]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(5,5,5,0.97)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24, cursor: 'pointer',
      }}
    >
      {/* Title */}
      <p style={{
        fontSize: 9, color: '#FF2E2E', letterSpacing: '0.3em',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        GLOBAL SIGNAL RADAR
      </p>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: 360, height: 360, opacity: 0.9 }}
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#FF2E2E', fontFamily: 'JetBrains Mono' }}>
            {totalEntities}
          </p>
          <p style={{ fontSize: 7, color: '#333', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono' }}>
            ENTITIES ACTIVE
          </p>
        </div>
        <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#888' }}>
            {strongestSignal}
          </p>
          <p style={{ fontSize: 7, color: '#333', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono' }}>
            STRONGEST SIGNAL
          </p>
        </div>
      </div>

      {/* Node labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 360, justifyContent: 'center' }}>
        {nodes.slice(0, 6).map(node => (
          <span key={node.id} style={{
            fontSize: 8, color: '#444', fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.1em', padding: '3px 8px',
            border: '1px solid rgba(255,255,255,0.04)', borderRadius: 2,
          }}>
            {node.room} ×{node.count}
          </span>
        ))}
      </div>

      <p style={{
        fontSize: 7, color: '#1A1A1A', letterSpacing: '0.2em',
        fontFamily: 'JetBrains Mono, monospace', marginTop: 16,
      }}>
        CLICK ANYWHERE TO CLOSE
      </p>
    </motion.div>
  );
};
