import { motion } from 'framer-motion';
import './Background.css';

export const Background = () => {
  return (
    <>
      {/* Animated Grid */}
      <div className="background-grid" />

      {/* Glowing Orbs */}
      <div className="background-orbs">
        <motion.div
          className="orb orb-1"
          animate={{
            x: [0, 50, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="orb orb-2"
          animate={{
            x: [0, -50, 0],
            y: [0, 50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 5,
          }}
        />
      </div>

      {/* Scanline Effect */}
      <motion.div
        className="scanline"
        animate={{
          y: ['-100%', '100vh'],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </>
  );
};
