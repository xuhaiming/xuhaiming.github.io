import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import ThreeScene from "../ThreeScene";

const TypewriterText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 50); // Typing speed

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return <span>{displayedText}</span>;
};

const MagneticButton = ({ children, onClick, className }: any) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current!.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    x.set((clientX - centerX) * 0.3);
    y.set((clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.button>
  );
};

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const yTitle = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const ySubtitle = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="h-[calc(100vh-134px)] md:h-screen w-full relative overflow-hidden"
    >
      <div className="absolute inset-0 z-0">
        <ThreeScene sceneType="hero" />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-space-dark to-transparent z-10" />

      <div className="container relative z-20 mx-auto px-4 h-full flex flex-col justify-center">
        <motion.h1
          style={{ y: yTitle, opacity }}
          className="text-4xl md:text-7xl font-bold mb-6"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          Creative <span className="text-gradient">Fullstack</span> <br />
          App <span className="text-neon-purple">Developer</span>
        </motion.h1>

        <motion.p
          style={{ y: ySubtitle, opacity }}
          className="text-xl md:text-2xl mb-8 max-w-lg text-white/80 h-[64px] md:h-[auto]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <TypewriterText
            text="Bringing ideas to life with code and creativity. Specializing in interactive experiences and immersive web design."
            delay={0.8}
          />
        </motion.p>

        <motion.div
           style={{ y: ySubtitle, opacity }}
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 1.5, duration: 0.5 }}
        >
            <MagneticButton
            onClick={() =>
                document
                .getElementById("about")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="group flex self-center md:self-start items-center gap-2 bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue text-neon-blue py-3 px-6 rounded-full transition-colors duration-300 w-fit"
            >
            About Me
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
            </svg>
            </MagneticButton>
        </motion.div>
      </div>

      <motion.div 
        className="absolute bottom-0 md:bottom-10 left-1/2 -translate-x-1/2 z-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center ">
          <p className="text-sm mb-2 text-white/70">Scroll Down</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-neon-blue"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
