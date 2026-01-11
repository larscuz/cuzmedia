
import React from 'react';
import { motion } from 'framer-motion';
import { PROJECTS } from '../constants';
import WorkCard from './WorkCard';

const WorkGrid: React.FC = () => {
  return (
    <div className="py-24 md:py-48 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-16 md:mb-32">
          <div>
            <h2 className="text-xs font-bold tracking-[0.5em] text-gray-500 mb-6 uppercase">Selected Work</h2>
            <h3 className="text-4xl md:text-6xl font-medium tracking-tight">Crafting digital signatures.</h3>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm opacity-50 max-w-xs font-light leading-relaxed">
              Merging aesthetics with functionality to create products that stand the test of time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-24 md:gap-y-48">
          {PROJECTS.map((project, idx) => (
            <WorkCard key={project.id} project={project} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkGrid;
