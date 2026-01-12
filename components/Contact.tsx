
import React from 'react';
import { motion } from 'framer-motion';

const Contact: React.FC = () => {
  return (
    <div className="py-24 md:py-48 px-6 md:px-12">
      <div className="max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <h2 className="text-xs font-bold tracking-[0.5em] text-gray-500 mb-16 uppercase italic">Start a Conversation</h2>
          <a 
            href="mailto:x@larscuzner.com"
            className="text-5xl md:text-[3vw] font-bold tracking-tighter leading-none hover:italic hover:opacity-70 transition-all duration-500 break-all"
          >
            lars@larscuzner.com
          </a>
          <div className="mt-24 md:mt-48 flex flex-col md:flex-row justify-center items-center gap-12 md:gap-32 opacity-50 text-sm font-light">
            <div className="group cursor-pointer">
              <span className="block text-[10px] tracking-widest font-bold mb-2 uppercase group-hover:translate-x-2 transition-transform">Instagram</span>
              <p>@cuzmedia_no</p>
            </div>
            <div className="group cursor-pointer">
              <span className="block text-[10px] tracking-widest font-bold mb-2 uppercase group-hover:translate-x-2 transition-transform">LinkedIn</span>
              <p>cuz-media-production</p>
            </div>
            <div className="group cursor-pointer">
              <span className="block text-[10px] tracking-widest font-bold mb-2 uppercase group-hover:translate-x-2 transition-transform">Address</span>
              <p>Oslo, Norway</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact;
