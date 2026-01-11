
import React from 'react';
import { motion } from 'framer-motion';
import { Project } from '../types';

interface WorkCardProps {
  project: Project;
  index: number;
}

const WorkCard: React.FC<WorkCardProps> = ({ project, index }) => {
  return (
    <motion.div 
      initial={{ y: 80, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: index % 2 === 0 ? 0 : 0.2 }}
      className={`group cursor-pointer ${index % 2 !== 0 ? 'md:mt-32' : ''}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#111] mb-8">
        <motion.img 
          src={project.image} 
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
          <span className="text-xs font-bold tracking-[0.3em] bg-white text-black px-6 py-3 rounded-full uppercase scale-90 group-hover:scale-100 transition-transform">
            View Project
          </span>
        </div>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] tracking-[0.3em] font-bold text-gray-500 mb-2 uppercase">{project.category}</p>
          <h4 className="text-2xl md:text-3xl font-medium tracking-tight mb-3 group-hover:italic transition-all">
            {project.title}
          </h4>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono opacity-30">{project.year}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default WorkCard;
