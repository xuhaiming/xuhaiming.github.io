import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
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

const ProjectsSection = forwardRef((props, ref) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const projectRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [selectedProject, setSelectedProject] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();

  // Expose the section ref
  useImperativeHandle(ref, () => sectionRef.current);

  // Reset animations when visibility changes
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleVisibilityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsVisible(customEvent.detail.isVisible);

      if (customEvent.detail.isVisible) {
        // Reset project card animations
        projectRefs.current.forEach((project, index) => {
          if (project) {
            project.style.opacity = "0";
            project.style.transform = `translateX(${
              index % 2 === 0 ? -30 : 30
            }px)`;
          }
        });
      }
    };

    section.addEventListener("visibility-change", handleVisibilityChange);
    return () => {
      section.removeEventListener("visibility-change", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current || !isVisible) return;

      // Calculate section scroll progress
      const sectionRect = sectionRef.current.getBoundingClientRect();
      const sectionTop = sectionRect.top;
      const sectionBottom = sectionRect.bottom;
      const viewportHeight = window.innerHeight;
      const sectionScrollProgress = Math.min(
        Math.max(1 - (sectionBottom - viewportHeight) / sectionRect.height, 0),
        1
      );

      // Project cards animation
      projectRefs.current.forEach((project, index) => {
        if (project) {
          // Scale the project visibility based on overall section progress
          const visibilityThreshold = 0.8;
          const numProjects = projectRefs.current.length;
          const staggeredAppearance =
            (index / (numProjects + 1)) * visibilityThreshold;

          const projectProgress = Math.min(
            Math.max(
              (sectionScrollProgress - staggeredAppearance) /
                (visibilityThreshold - staggeredAppearance),
              0
            ),
            1
          );

          project.style.opacity = projectProgress.toString();
          project.style.transform = `translateX(${
            (1 - projectProgress) * (index % 2 === 0 ? -30 : 30)
          }px)`;
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    // Call immediately to set initial state
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isVisible]);

  return (
    <section
      id="projects"
      className="min-h-screen py-16 md:py-20 relative bg-space"
      ref={sectionRef}
      data-in-view={isVisible ? "true" : "false"}
    >
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-space-dark to-transparent z-10" />

      <div className="container mx-auto px-4 relative z-20">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12 md:mb-16 text-gradient text-center">
          Featured Projects
        </h2>

        <div
          className={`grid grid-cols-1 ${
            isMobile ? "" : "lg:grid-cols-5"
          } gap-6 md:gap-8`}
        >
          {/* 3D Scene - Only show on desktop */}
          {!isMobile && (
            <div className="lg:col-span-2">
              <div
                ref={sceneRef}
                className="mt-[-4px]"
                style={{ height: "684px" }}
              >
                <ThreeScene
                  sceneType="projects"
                  className="rounded-lg overflow-hidden border border-neon-purple/30 h-full"
                  selectedProject={selectedProject}
                />
              </div>
            </div>
          )}

          {/* Projects List */}
          <div
            className={`${
              isMobile ? "col-span-1" : "lg:col-span-3"
            } space-y-8 md:space-y-12`}
          >
            {projects.map((project, index) => (
              <div
                key={project.title}
                ref={(el) => (projectRefs.current[index] = el)}
                className={`relative bg-space-light p-4 md:p-6 rounded-lg border transition-all duration-700 transform hover:scale-105 opacity-0 cursor-pointer ${
                  selectedProject === index
                    ? "border-neon-blue/30"
                    : "border-neon-blue/30 hover:border-neon-blue/60"
                }`}
                style={{
                  transitionDelay: `${index * 200}ms`,
                  transform: `translateX(${index % 2 === 0 ? -30 : 30}px)`,
                }}
                onClick={() => setSelectedProject(index)}
              >
                <h3 className="text-xl md:text-2xl font-bold mb-2 text-neon-blue">
                  {project.title}
                </h3>
                <p className="text-white/70 mb-4 text-sm md:text-base">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-space px-2 md:px-3 py-1 rounded-full text-xs text-neon-purple"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Desktop selection indicator */}
                {!isMobile && (
                  <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                      selectedProject === index ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-pink to-transparent opacity-70 animate-pulse"
                      style={{ animationDuration: "3s" }}
                    ></div>
                    <div
                      className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-pink to-transparent opacity-70 animate-pulse"
                      style={{ animationDuration: "4s" }}
                    ></div>
                    <div
                      className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-neon-pink to-transparent opacity-70 animate-pulse"
                      style={{ animationDuration: "3.5s" }}
                    ></div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-neon-pink to-transparent opacity-70 animate-pulse"
                      style={{ animationDuration: "2.5s" }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-space-dark to-transparent z-10" />
    </section>
  );
});

ProjectsSection.displayName = "ProjectsSection";
export default ProjectsSection;
