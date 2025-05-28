import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import ThreeScene from "../ThreeScene";

const HeroSection = forwardRef((props, ref) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Expose the section ref
  useImperativeHandle(ref, () => sectionRef.current);

  // Reset animations when visibility changes
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleVisibilityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsVisible(customEvent.detail.isVisible);

      // Reset parallax effect when section comes into view
      if (
        customEvent.detail.isVisible &&
        titleRef.current &&
        subtitleRef.current &&
        buttonRef.current
      ) {
        titleRef.current.style.transform = "translateY(0)";
        subtitleRef.current.style.transform = "translateY(0)";
        buttonRef.current.style.transform = "translateY(0)";
      }
    };

    section.addEventListener("visibility-change", handleVisibilityChange);
    return () => {
      section.removeEventListener("visibility-change", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Only apply parallax effect when section is visible
      if (
        isVisible &&
        titleRef.current &&
        subtitleRef.current &&
        buttonRef.current
      ) {
        const scrollY = window.scrollY;
        titleRef.current.style.transform = `translateY(${scrollY * 0.2}px)`;
        subtitleRef.current.style.transform = `translateY(${scrollY * 0.1}px)`;
        buttonRef.current.style.transform = `translateY(${scrollY * 0.05}px)`;
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isVisible]);

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
        <h1
          ref={titleRef}
          className="text-4xl md:text-7xl font-bold mb-6 parallax-text"
        >
          Creative <span className="text-gradient">Developer</span> <br />&{" "}
          <span className="text-neon-purple">Designer</span>
        </h1>

        <p
          ref={subtitleRef}
          className="text-xl md:text-2xl mb-8 max-w-lg parallax-text text-white/80"
        >
          Bringing ideas to life with code and creativity. Specializing in
          interactive experiences and immersive web design.
        </p>

        <button
          ref={buttonRef}
          onClick={() =>
            document
              .getElementById("about")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="group flex self-center md:self-start items-center gap-2 bg-neon-blue/10 hover:bg-neon-blue/20 border border-neon-blue text-neon-blue py-3 px-6 rounded-full transition-all duration-300 w-fit parallax-text"
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
        </button>
      </div>

      <div className="absolute bottom-0 md:bottom-10 left-1/2 -translate-x-1/2 z-20">
        <div className="animate-bounce flex flex-col items-center ">
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
      </div>
    </section>
  );
});

HeroSection.displayName = "HeroSection";
export default HeroSection;
