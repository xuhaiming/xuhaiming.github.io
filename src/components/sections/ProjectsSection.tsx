import React, { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, Variants } from "framer-motion";
import ThreeScene from "../ThreeScene";
import { useIsMobile } from "@/hooks/use-mobile";

interface Project {
  title: string;
  description: string;
  tags: string[];
}

const projects: Project[] = [
  {
    title: "AI-powered Product Management System",
    description:
      "A sophisticated Product Information Management (PIM) system leveraging AI for automated data enrichment, dynamic image generation, and seamless multi-channel content distribution.",
    tags: ["LLM", "Next.js", "AWS"],
  },
  {
    title: "E-commerce Platform",
    description:
      "Engineered and delivered robust e-commerce solutions for prominent brands like Shopee and Burberry, focusing on user experience and scalability.",
    tags: [
      "Design System",
      "Performance Optimization",
      "Scalable Project Architecture",
    ],
  },
  {
    title: "Training Data Labeling Platform",
    description:
      "Developed a comprehensive data labeling platform to streamline the creation of high-quality training datasets for artificial intelligence models.",
    tags: ["Low Code", "Dynamic Form", "Tencent Cloud"],
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring",
      stiffness: 100,
      damping: 15,
      duration: 0.6
    }
  }
};

const ProjectCard = ({ project, index, isSelected, onClick }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const xSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const ySpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(0, 238, 255, 0.15), transparent 80%)`;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    const xPct = clientX / width - 0.5;
    const yPct = clientY / height - 0.5;
    
    x.set(yPct * 20); // Increased tilt range
    y.set(xPct * -20);
    mouseX.set(clientX);
    mouseY.set(clientY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      style={{ 
        transformStyle: "preserve-3d", 
        rotateX: xSpring, 
        rotateY: ySpring 
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative bg-space-light/80 backdrop-blur-xl p-6 md:p-8 rounded-xl border transition-all duration-500 cursor-pointer group perspective-1000 overflow-hidden ${
        isSelected
          ? "border-neon-blue/60 shadow-[0_0_50px_-10px_rgba(0,238,255,0.3)]"
          : "border-neon-blue/20 hover:border-neon-blue/50"
      }`}
    >
      {/* Spotlight Effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-30"
        style={{ background: spotlight }}
      />

      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />

      <div style={{ transform: "translateZ(50px)" }} className="relative z-20">
        <h3 className="text-xl md:text-2xl font-bold mb-3 text-neon-blue group-hover:text-white transition-colors duration-300">
          {project.title}
        </h3>
        <p className="text-white/70 mb-6 text-sm md:text-base leading-relaxed group-hover:text-white/90 transition-colors duration-300">
          {project.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag: string) => (
            <span
              key={tag}
              className="bg-space-dark/50 px-3 py-1 rounded-full text-xs font-medium text-neon-purple border border-neon-purple/20 group-hover:border-neon-purple/40 transition-colors duration-300 shadow-[0_0_10px_-5px_rgba(176,38,255,0.3)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      {isSelected && (
        <motion.div
          layoutId="active-glow"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon-blue/10 to-neon-purple/10 pointer-events-none z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
};

const ProjectsSection = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [selectedProject, setSelectedProject] = useState(1);
  const isMobile = useIsMobile();

  return (
    <section
      id="projects"
      className="min-h-screen py-20 md:py-28 relative bg-space overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-space-dark to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-space-dark to-transparent z-10 pointer-events-none" />
      
      {/* Dynamic Background Blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: 1
        }}
        className="absolute bottom-1/4 left-0 w-[600px] h-[600px] bg-neon-blue/10 rounded-full blur-[120px] pointer-events-none" 
      />

      <div className="container mx-auto px-4 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16 md:mb-24"
        >
          <motion.h2 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-white to-neon-purple inline-block"
          >
            Featured Projects
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-white/60 text-lg max-w-2xl mx-auto"
          >
            A selection of my recent work, showcasing complex systems and user-centric applications.
          </motion.p>
        </motion.div>

        <div
          className={`grid grid-cols-1 ${
            isMobile ? "" : "lg:grid-cols-5"
          } gap-8 lg:gap-12 items-start`}
        >
          {/* 3D Scene - Only show on desktop */}
          {!isMobile && (
            <div className="lg:col-span-2 sticky top-24">
              <motion.div
                ref={sceneRef}
                className="h-[600px] w-full"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.2, type: "spring" }}
              >
                <div className="relative h-full w-full rounded-2xl overflow-hidden border border-neon-purple/20 bg-space-light/30 backdrop-blur-sm shadow-2xl shadow-neon-purple/10">
                  <ThreeScene
                    sceneType="projects"
                    className="h-full w-full"
                    selectedProject={selectedProject}
                  />
                  
                  {/* Decorative overlay for the 3D scene */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-space-dark/50 to-transparent" />
                </div>
              </motion.div>
            </div>
          )}

          {/* Projects List */}
          <motion.div
            className={`${
              isMobile ? "col-span-1" : "lg:col-span-3"
            } space-y-6 md:space-y-8`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            transition={{ staggerChildren: 0.2 }}
          >
            {projects.map((project, index) => (
              <ProjectCard
                key={project.title}
                project={project}
                index={index}
                isSelected={selectedProject === index}
                onClick={() => setSelectedProject(index)}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;
