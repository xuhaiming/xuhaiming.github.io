import React, { useRef } from "react";
import { motion } from "framer-motion";
import ThreeScene from "../ThreeScene";
import { Mail, MapPin, Github, Linkedin } from "lucide-react";
import ParticleEffect from "../ParticleEffect";

const ContactSection = () => {
  const sectionRef = useRef<HTMLElement>(null);

  // Profile information
  const profile = {
    name: "Haiming Xu",
    title: "Creative Software Engineer",
    bio: "A creative software engineer dedicated to crafting immersive digital experiences by integrating cutting-edge technology with elegant design. My expertise in web development and diverse software engineering disciplines enables me to deliver distinctive digital solutions that elevate brand presence.",
    location: "Singapore",
    email: "haiming12322@gmail.com",
    availability: "Passion for innovation projects",
    links: {
      github: "https://github.com/xuhaiming",
      linkedin: "https://www.linkedin.com/in/xu-haiming-48502869",
    },
  };

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="min-h-screen py-20 relative bg-space-dark overflow-hidden"
    >
      {/* Background glow effects */}
      <div className="absolute top-0 left-0 w-full h-full">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full filter blur-[100px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-neon-purple/10 rounded-full filter blur-[100px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-2/3 right-1/4 w-64 h-64 bg-neon-pink/10 rounded-full filter blur-[100px]"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-space to-transparent z-10" />

      <div className="container mx-auto px-4 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <motion.h2 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-3xl md:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-white to-neon-purple inline-block"
          >
            Get In Touch
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-white/70 text-lg max-w-2xl mx-auto"
          >
            Let's collaborate to bring your digital vision to life. I'm always
            open to discussing new projects, creative ideas, or opportunities to
            be part of your vision.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left side - Profile information */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-space-light/40 p-8 rounded-lg backdrop-blur-sm border border-neon-blue/20 relative overflow-hidden group"
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
                <motion.div
                  className="relative h-20 w-20 rounded-full bg-gradient-to-br from-neon-blue via-neon-purple to-neon-pink p-1"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <div className="h-full w-full rounded-full bg-space-dark flex items-center justify-center overflow-hidden">
                    <span className="text-3xl font-bold text-white">
                      {profile.name.charAt(0)}
                    </span>
                  </div>

                  {/* Glow effect around avatar */}
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink opacity-30 blur-sm"></div>
                </motion.div>
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
                <motion.div 
                  className="flex items-center gap-3"
                  whileHover={{ x: 10 }}
                >
                  <div className="bg-neon-purple/20 p-3 rounded-full">
                    <MapPin className="h-5 w-5 text-neon-purple" />
                  </div>
                  <span className="text-white/80">{profile.location}</span>
                </motion.div>

                <motion.div 
                  className="flex items-center gap-3"
                  whileHover={{ x: 10 }}
                >
                  <div className="bg-neon-blue/20 p-3 rounded-full">
                    <Mail className="h-5 w-5 text-neon-blue" />
                  </div>
                  <span className="text-white/80">{profile.email}</span>
                </motion.div>
              </div>

              <div className="mb-8">
                <motion.div
                  className="inline-block bg-neon-pink/20 px-4 py-2 rounded-full"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-neon-pink font-medium">
                    {profile.availability}
                  </span>
                </motion.div>
              </div>

              <div className="flex space-x-4">
                <motion.a
                  href={profile.links.github}
                  className="bg-space p-3 rounded-full text-white hover:text-neon-blue border border-white/10 hover:border-neon-blue"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="GitHub"
                >
                  <Github className="h-5 w-5" />
                </motion.a>
                <motion.a
                  href={profile.links.linkedin}
                  className="bg-space p-3 rounded-full text-white hover:text-neon-pink border border-white/10 hover:border-neon-pink"
                  whileHover={{ scale: 1.2, rotate: -10 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </motion.a>
              </div>
            </div>
          </motion.div>

          {/* Right side - Enhanced 3D Squared Display */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative group"
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
                  Scan the QR code on the 3D model to view my detailed LinkedIn
                  profile.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {["React", "Next.js", "TypeScript", "LLM"].map((tech, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="inline-block px-3 py-1 text-xs rounded-full bg-space border border-neon-blue/30 hover:border-neon-blue hover:bg-neon-blue/10 transition-colors duration-300"
                    >
                      {tech}
                    </motion.span>
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
          </motion.div>
        </div>

        {/* New Particle Effect Component */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <h3 className="text-2xl font-bold mt-24 mb-6 text-center">
            <span className="text-gradient">Website Developed By</span>
          </h3>
          <ParticleEffect />
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-space-dark to-transparent z-10" />
    </section>
  );
};

export default ContactSection;
