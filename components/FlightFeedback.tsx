'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGame } from '@/store/game';

// Feedback is independent of layout so it never moves the game or betting controls.
export default function FlightFeedback() {
  const { feedback, clearFeedback, animations } = useGame();
  const reduced = useReducedMotion();
  const animate = animations && !reduced;
  useEffect(() => {
    if (!feedback) return;
    const id = feedback.id;
    const timer = window.setTimeout(() => clearFeedback(id), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback, clearFeedback]);
  return <div className="flight-feedback-layer" role="status" aria-live="polite" aria-atomic="true">
    <AnimatePresence initial={false} mode="wait">
      {feedback && <motion.div
        key={feedback.id}
        className={`flight-feedback flight-feedback-${feedback.kind}`}
        initial={animate ? { opacity: 0, y: -32, scale: .96 } : { opacity: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={animate ? { opacity: 0, y: -30, scale: .97 } : { opacity: 0 }}
        transition={animate ? { type: 'spring', stiffness: 420, damping: 32, mass: .8 } : { duration: 0 }}
      >
        <span className="flight-feedback-text">{feedback.text}</span>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
