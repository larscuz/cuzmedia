
import React from 'react';
import { motion } from 'framer-motion';
import { KEYWORDS } from '../constants';

const Hero: React.FC = () => {
  return (
    <div className="relative h-screen w-full flex flex-col justify-center items-center px-6 md:px-12 overflow-hidden bg-black">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-60"
          poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
        >
          <source 
            src="https://larscuzner.com/media/BHKI25.mp4" 
            type="video/mp4" 
          />
          Your browser does not support the video tag.
        </video>
        {/* Cinematic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#050505] z-10"></div>
      </div>

      <div className="relative z-20 w-full max-w-7xl">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <h2 className="text-xs font-medium tracking-[0.5em] text-white/60 mb-6 flex items-center gap-4">
            <span className="w-8 h-px bg-white/30"></span>
            
          </h2>
          <h1 className="text-5xl md:text-8xl lg:text-[11rem] font-bold leading-[0.85] tracking-tighter text-white drop-shadow-2xl">
             <br />
            <span className="ml-[0.1em] md:ml-[0.2em] italic font-light text-white/90"></span>
          </h1>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          //className="flex flex-wrap gap-4 md:gap-8 mt-16 border-t border-white/20 pt-12"
        >
          {KEYWORDS.map((word, idx) => (
            <div key={idx} className="flex items-center gap-4 group cursor-default">
              <span className="text-[10px] md:text-xs font-bold tracking-[0.4em] text-white/50 group-hover:text-white transition-colors duration-500 uppercase">
                {word}
              </span>
              {idx !== KEYWORDS.length - 1 && (
                <div className="w-1 h-1 rounded-full bg-white/30 group-hover:bg-white transition-colors"></div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4"
      >
        <div className="w-px h-16 bg-gradient-to-b from-white/60 to-transparent relative overflow-hidden">
          <motion.div 
            animate={{ y: [0, 64] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 left-0 w-full h-1/2 bg-white"
          />
        </div>
        <span className="text-[9px] tracking-[0.6em] font-bold text-white/40 uppercase rotate-180 [writing-mode:vertical-lr]">
          SCROLL
        </span>
      </motion.div>
    </div>
  );
};

export default Hero;
