
import React from 'react';
import { motion } from 'framer-motion';

const About: React.FC = () => {
  return (
    <div className="py-24 md:py-48 px-6 md:px-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-32">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <h2 className="text-xs font-bold tracking-[0.5em] text-gray-500 mb-10 uppercase">Our Approach</h2>
          <p className="text-3xl md:text-5xl font-light leading-tight tracking-tight">
            I 2026 er KI-reklame standard.
Vi er et studio som jobber  <span className="italic">i skjæringspunktet mellom</span>  kultur og <span className="font-medium">intelligent teknologi.</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex flex-col justify-end"
        >
          <div className="space-y-8 max-w-lg">
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Mens etablerte aktører snakker om talentmangel,
ansetter vi dem.

Cuz Media kombinerer lærlinger, KI og strategi til digitale identiteter som faktisk treffer.
Minimalistisk utførelse. Maksimal effekt.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/10">
              <div>
                <h4 className="text-[10px] tracking-widest font-bold mb-4 uppercase">Specialties</h4>
                <ul className="text-xs space-y-2 opacity-60 leading-relaxed font-light">
                  <li>UX Strategy</li>
                  <li>Interface Design</li>
                  <li>Art Direction</li>
                  <li>Interactive Systems</li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] tracking-widest font-bold mb-4 uppercase">Technology</h4>
                <ul className="text-xs space-y-2 opacity-60 leading-relaxed font-light">
                  <li>Modern Web Frameworks</li>
                  <li>Real-time Graphics</li>
                  <li>Motion Frameworks</li>
                  <li>Cloud Infrastructure</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default About;
