
import React from 'react';
import { motion } from 'framer-motion';

interface NavbarProps {
  activeSection: string;
}

const Navbar: React.FC<NavbarProps> = ({ activeSection }) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navItems = [
    { label: 'WORK', id: 'work' },
    { label: 'ABOUT', id: 'about' },
    { label: 'CONTACT', id: 'contact' }
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 p-6 md:p-10 flex justify-between items-center mix-blend-difference pointer-events-none">
      <div 
        className="text-4xl font-bold tracking-tighter cursor-pointer pointer-events-auto"
        onClick={() => scrollTo('home')}
      >
        CUZ  media<span className="text-xs ml-1">®</span>
      </div>

      <div className="flex gap-8 pointer-events-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className={`text-xs font-medium tracking-widest transition-opacity duration-300 ${
              activeSection === item.id ? 'opacity-100 underline underline-offset-4' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
