
import React, { useState, useEffect } from 'react';

const Footer: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'Europe/Oslo' 
    });
  };

  return (
    <footer className="px-6 md:px-12 py-12 md:py-20 border-t border-white/5 bg-[#050505]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
        <div className="space-y-4">
          <div className="text-2xl font-bold tracking-tighter">CUZMEDIA®</div>
          <p className="text-[10px] tracking-widest uppercase opacity-40 font-bold max-w-xs">
            © 2024 CUZMEDIA PRODUCTION AS. ALL RIGHTS RESERVED.
          </p>
        </div>

        <div className="flex flex-col md:items-end gap-4 font-mono">
          <div className="flex items-center gap-4 text-xs tracking-widest uppercase opacity-40 font-bold">
            <span>OSLO, NO</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span>{formatTime(time)}</span>
          </div>
          <p className="text-[10px] opacity-40">BUILT WITH PRECISION IN NORWAY</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
