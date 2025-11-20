import React, { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
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
      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      style={{ transformStyle: "preserve-3d", transform }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative bg-space-light p-4 md:p-6 rounded-lg border transition-all duration-300 cursor-pointer group perspective-1000 ${
        isSelected
          ? "border-neon-blue/60 shadow-[0_0_30px_-5px_rgba(0,238,255,0.3)]"
          : "border-neon-blue/30 hover:border-neon-blue/60"
      }`}
    >
      <div style={{ transform: "translateZ(20px)" }}>
        <h3 className="text-xl md:text-2xl font-bold mb-2 text-neon-blue group-hover:text-white transition-colors">
          {project.title}
        </h3>
        <p className="text-white/70 mb-4 text-sm md:text-base group-hover:text-white/90 transition-colors">
          {project.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {project.tags.map((tag: string) => (
            <span
              key={tag}
              className="bg-space px-2 md:px-3 py-1 rounded-full text-xs text-neon-purple border border-neon-purple/20"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      {isSelected && (
        <motion.div
          layoutId="active-glow"
          className="absolute inset-0 rounded-lg bg-neon-blue/5 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
      className="min-h-screen py-16 md:py-20 relative bg-space"
    >
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-space-dark to-transparent z-10" />

      <div className="container mx-auto px-4 relative z-20">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12 md:mb-16 text-gradient text-center"
        >
          Featured Projects
        </motion.h2>

        <div
          className={`grid grid-cols-1 ${
            isMobile ? "" : "lg:grid-cols-5"
          } gap-6 md:gap-8`}
        >
          {/* 3D Scene - Only show on desktop */}
          {!isMobile && (
            <div className="lg:col-span-2">
              <motion.div
                ref={sceneRef}
                className="mt-[-4px] sticky top-24"
                style={{ height: "684px" }}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <ThreeScene
                  sceneType="projects"
                  className="rounded-lg overflow-hidden border border-neon-purple/30 h-full shadow-2xl shadow-neon-purple/20"
                  selectedProject={selectedProject}
                />
              </motion.div>
            </div>
          )}

          {/* Projects List */}
          <div
            className={`${
              isMobile ? "col-span-1" : "lg:col-span-3"
            } space-y-8 md:space-y-12`}
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
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-space-dark to-transparent z-10" />
    </section>
  );
};

export default ProjectsSection;
