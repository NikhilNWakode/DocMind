"use client";

import { motion } from "framer-motion";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 bg-accent/50 rounded-full"
          animate={{
            y: [0, -3, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export { TypingIndicator };
