import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import ThreeScene from "../ThreeScene";
import { Mail, MapPin, Github, Linkedin } from "lucide-react";
import ParticleEffect from "../ParticleEffect";

const ContactSection = forwardRef((props, ref) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Expose the section ref
  useImperativeHandle(ref, () => sectionRef.current);

  // Profile information
  const profile = {
    name: "Haiming Xu",
    title: "Creative Software Engineer",
    bio: "Passionate about creating immersive digital experiences that blend cutting-edge technology with beautiful design. With 8+ years of experience in web development and 3D visualization, I help brands stand out with memorable digital solutions.",
    location: "Singapore",
    email: "haiming12322@gmail.com",
    availability: "Available for freelance projects",
    links: {
      github: "https://github.com/xuhaiming",
      linkedin: "https://www.linkedin.com/in/xu-haiming-48502869",
    },
  };

  // Reset animations when visibility changes
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleVisibilityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsVisible(customEvent.detail.isVisible);
    };

    section.addEventListener("visibility-change", handleVisibilityChange);
    return () => {
      section.removeEventListener("visibility-change", handleVisibilityChange);
    };
  }, []);

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="min-h-screen py-20 relative bg-space-dark overflow-hidden"
      data-in-view={isVisible ? "true" : "false"}
    >
      {/* Background glow effects */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full filter blur-[100px] animate-pulse"
          style={{ animationDuration: "7s" }}
        ></div>
        <div
          className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-neon-purple/10 rounded-full filter blur-[100px] animate-pulse"
          style={{ animationDuration: "10s" }}
        ></div>
        <div
          className="absolute top-2/3 right-1/4 w-64 h-64 bg-neon-pink/10 rounded-full filter blur-[100px] animate-pulse"
          style={{ animationDuration: "8s" }}
        ></div>
      </div>

      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-space to-transparent z-10" />

      <div className="container mx-auto px-4 relative z-20">
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gradient text-center">
          Get In Touch
        </h2>

        <p className="text-white/70 text-center max-w-2xl mx-auto mb-16">
          Let's collaborate to bring your digital vision to life. I'm always
          open to discussing new projects, creative ideas, or opportunities to
          be part of your vision.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left side - Profile information */}
          <div
            className={`bg-space-light/40 p-8 rounded-lg backdrop-blur-sm border border-neon-blue/20 relative overflow-hidden group transition-opacity duration-500 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/10 via-neon-purple/5 to-neon-pink/10 opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>

            {/* Glowing border effect */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-blue to-transparent opacity-70"></div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-70"></div>
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-neon-pink to-transparent opacity-70"></div>
              <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-neon-blue to-transparent opacity-70"></div>
            </div>

            <div className="relative z-10">
              <div className="mb-8 flex items-center">
                <div
                  className="relative h-20 w-20 rounded-full bg-gradient-to-br from-neon-blue via-neon-purple to-neon-pink p-1 animate-pulse"
                  style={{ animationDuration: "3s" }}
                >
                  <div className="h-full w-full rounded-full bg-space-dark flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {profile.name.charAt(0)}
                    </span>
                  </div>

                  {/* Glow effect around avatar */}
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink opacity-30 blur-sm"></div>
                </div>
                <div className="ml-5">
                  <h3 className="text-2xl font-bold text-white">
                    {profile.name}
                  </h3>
                  <p className="text-neon-blue">{profile.title}</p>
                </div>
              </div>

              <p className="text-white/80 mb-8 leading-relaxed">
                {profile.bio}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 transform hover:translate-x-1 transition-transform duration-300">
                  <div className="bg-neon-purple/20 p-3 rounded-full">
                    <MapPin className="h-5 w-5 text-neon-purple" />
                  </div>
                  <span className="text-white/80">{profile.location}</span>
                </div>

                <div className="flex items-center gap-3 transform hover:translate-x-1 transition-transform duration-300">
                  <div className="bg-neon-blue/20 p-3 rounded-full">
                    <Mail className="h-5 w-5 text-neon-blue" />
                  </div>
                  <span className="text-white/80">{profile.email}</span>
                </div>
              </div>

              <div className="mb-8">
                <div
                  className="inline-block bg-neon-pink/20 px-4 py-2 rounded-full animate-pulse"
                  style={{ animationDuration: "4s" }}
                >
                  <span className="text-neon-pink font-medium">
                    {profile.availability}
                  </span>
                </div>
              </div>

              <div className="flex space-x-4">
                <a
                  href={profile.links.github}
                  className="bg-space p-3 rounded-full hover:bg-neon-blue/20 hover:text-neon-blue hover:scale-110 transition-all duration-300 ease-out"
                  aria-label="GitHub"
                >
                  <Github className="h-5 w-5" />
                </a>
                <a
                  href={profile.links.linkedin}
                  className="bg-space p-3 rounded-full hover:bg-neon-pink/20 hover:text-neon-pink hover:scale-110 transition-all duration-300 ease-out"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Right side - Enhanced 3D Squared Display */}
          <div
            className={`relative group transition-opacity duration-500 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: "0.2s" }}
          >
            <div className="h-[600px] rounded-lg overflow-hidden border border-neon-purple/30 relative group perspective-1000 transform transition-all duration-500 hover:scale-[1.01]">
              {/* Enhanced 3D scene backdrop with proper styling */}
              <div className="absolute inset-0 z-10">
                <ThreeScene sceneType="contact" />
              </div>

              {/* Animated overlay effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/10 via-transparent to-neon-pink/20 opacity-40 mix-blend-overlay pointer-events-none"></div>

              {/* Enhanced bottom info card with animations */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-black/50 backdrop-blur-sm z-30 transform transition-transform duration-500 border-t border-neon-purple/30">
                <h3 className="text-xl font-bold text-white mb-2 text-gradient">
                  Interactive Portfolio
                </h3>
                <p className="text-white/70">
                  Explore my creative universe through this interactive 3D
                  visualization. Each element represents a project or skill in
                  my portfolio.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "WebGL",
                    "Three.js",
                    "React Three Fiber",
                    "Interactive Design",
                  ].map((tech, i) => (
                    <span
                      key={i}
                      className="inline-block px-3 py-1 text-xs rounded-full bg-space border border-neon-blue/30 hover:border-neon-blue hover:bg-neon-blue/10 transition-colors duration-300"
                      style={{ transitionDelay: `${i * 0.1}s` }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Enhanced glowing effect on edges with animation */}
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-blue to-transparent opacity-70 animate-pulse"
                  style={{ animationDuration: "3s" }}
                ></div>
                <div
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-70 animate-pulse"
                  style={{ animationDuration: "4s" }}
                ></div>
                <div
                  className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-neon-pink to-transparent opacity-70 animate-pulse"
                  style={{ animationDuration: "3.5s" }}
                ></div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-neon-blue to-transparent opacity-70 animate-pulse"
                  style={{ animationDuration: "2.5s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* New Particle Effect Component */}
        <div
          className={`transition-opacity duration-700 delay-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <h3 className="text-2xl font-bold mt-24 mb-6 text-center">
            <span className="text-gradient">Website Developed By</span>
          </h3>
          <ParticleEffect />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-space-dark to-transparent z-10" />
    </section>
  );
});

ContactSection.displayName = "ContactSection";
export default ContactSection;
