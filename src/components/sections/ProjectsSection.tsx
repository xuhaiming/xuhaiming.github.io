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
  const xSpring = useSpring(x);
  const ySpring = useSpring(y);
  const transform = useMotionTemplate`rotateX(${xSpring}deg) rotateY(${ySpring}deg)`;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(yPct * 10);
    y.set(xPct * -10);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      style={{ transformStyle: "preserve-3d", transform }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative bg-space-light p-6 md:p-8 rounded-xl border transition-all duration-500 cursor-pointer group perspective-1000 overflow-hidden ${
        isSelected
          ? "border-neon-blue/60 shadow-[0_0_40px_-10px_rgba(0,238,255,0.4)]"
          : "border-neon-blue/20 hover:border-neon-blue/50 hover:shadow-[0_0_20px_-5px_rgba(0,238,255,0.2)]"
      }`}
    >
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div style={{ transform: "translateZ(20px)" }} className="relative z-10">
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
              className="bg-space-dark/50 px-3 py-1 rounded-full text-xs font-medium text-neon-purple border border-neon-purple/20 group-hover:border-neon-purple/40 transition-colors duration-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      {isSelected && (
        <motion.div
          layoutId="active-glow"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-neon-blue/10 to-neon-purple/10 pointer-events-none"
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
      
      {/* Subtle background glow */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-neon-purple/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-neon-blue/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16 md:mb-24"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gradient inline-block">
            Featured Projects
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            A selection of my recent work, showcasing complex systems and user-centric applications.
          </p>
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
