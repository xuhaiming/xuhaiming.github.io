import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import ThreeScene from "../ThreeScene";
import VideoSkeleton from "../VideoSkeleton";
import VideoFallback from "../VideoFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useMobileVideo } from "@/hooks/use-mobile-video";

const AboutSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });
  
  // NEW: Track if 3D scene should be visible (more aggressive threshold)
  const sceneInView = useInView(sectionRef, { 
    once: false, 
    amount: 0.1,
    margin: "100px"
  });
  
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoCanPlay, setVideoCanPlay] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const yImage = useTransform(scrollYProgress, [0, 1], [100, -100]);

  // Use mobile video hook for better mobile support
  const {
    isMobileDevice,
    getVideoAttributes,
    getVideoStyles,
    playVideo,
  } = useMobileVideo();


  // Handle video loading events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      console.log("Video loaded data");
      setVideoLoaded(true);
    };

    const handleCanPlay = () => {
      console.log("Video can play");
      setVideoCanPlay(true);
    };

    const handleLoadStart = () => {
      console.log("Video load started");
      setVideoLoaded(false);
      setVideoCanPlay(false);
    };

    const handleError = (e: Event) => {
      console.error("Video error:", e);
      setVideoLoaded(false);
      setVideoCanPlay(false);
      setVideoError(true);
    };

    const handleLoadedMetadata = () => {
      console.log("Video metadata loaded");
      // Force display of first frame on iOS Safari
      if (video.currentTime === 0) {
        video.currentTime = 0.001;
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("error", handleError);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  // Reset video when section becomes visible with better mobile handling
  useEffect(() => {
    if (isInView && videoRef.current && videoCanPlay) {
      playVideo(videoRef.current);
    }
  }, [isInView, videoCanPlay, playVideo]);

  // Function to retry video loading
  const retryVideo = () => {
    setVideoError(false);
    setVideoLoaded(false);
    setVideoCanPlay(false);

    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return (
    <section
      id="about"
      ref={sectionRef}
      className="min-h-screen py-20 relative bg-space"
    >
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-space-dark to-transparent z-10" />

      <div className="container mx-auto px-4 relative z-20" ref={containerRef}>
        <motion.h2 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-3xl md:text-5xl font-bold mb-16 text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-white to-neon-purple inline-block text-center"
        >
          About Me
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="md:order-2 relative h-[500px] w-full">
            <div className="absolute inset-0">
              <ThreeScene sceneType="about" isVisible={sceneInView} />
            </div>

            <motion.div
              style={{ y: yImage }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            />
          </div>

          <motion.div 
            className="md:order-1 space-y-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              "I am currently serving as the Lead Frontend Engineer at Trustana, where I spearhead the development of AI-driven applications.",
              "Throughout my career, I have collaborated with renowned companies such as Shopee, Tencent, Burberry, ThoughtWorks, Phillips, and more.",
              "My expertise predominantly lies in frontend technologies including React, Next.js, and Node.js. However, I also possess substantial experience with backend and AI-related technologies such as AWS serverless architecture, MongoDB, AI agents leveraging OpenAI APIs, Gemini, RAG, and prompt engineering.",
              "Additionally, I have contributed to AI-driven image, 3D and video generation projects using advanced tools such as Stable Diffusion, Hunyuan, Wan Video, Flux. I have also worked extensively with ComfyUI workflows, including Lora, ControlNet, IP Adapter, etc.",
            ].map((text, index) => (
              <motion.p
                key={index}
                variants={itemVariants}
                className="text-lg"
              >
                {text}
              </motion.p>
            ))}

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap gap-3"
            >
              {[
                "Creative",
                "Detail-oriented",
                "Problem Solver",
                "Team Player",
                "Innovative",
              ].map((trait) => (
                <span
                  key={trait}
                  className="bg-space-light px-3 py-1 rounded-full text-sm text-neon-blue border border-neon-blue/20"
                >
                  {trait}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Video Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-24 mb-8"
        >
          <h3 className="text-2xl md:text-3xl font-bold mb-8 text-gradient text-center">
            See My Work In Action
          </h3>

          <div className="max-w-4xl mx-auto">
            <AspectRatio
              ratio={16 / 9}
              className="bg-space-light rounded-lg overflow-hidden relative shadow-2xl shadow-neon-blue/10 border border-white/5"
            >
              {/* Show skeleton while video is loading */}
              {!videoCanPlay && !videoError && <VideoSkeleton />}

              {/* Show fallback when video fails */}
              {videoError && (
                <VideoFallback
                  onRetry={retryVideo}
                  message={
                    isMobileDevice
                      ? "Video not supported on this mobile device"
                      : "Video failed to load"
                  }
                />
              )}

              {/* Video element with enhanced mobile support */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  videoCanPlay && !videoError ? "opacity-100" : "opacity-0"
                }`}
                loop
                {...getVideoAttributes()}
                style={getVideoStyles()}
              >
                <source src="/assets/compressed.mp4#t=0.001" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </AspectRatio>
            <p className="text-center text-sm text-gray-400 mt-4">
              AI generated video with trained LoRA models
            </p>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-space-dark to-transparent z-10" />
    </section>
  );
};

export default AboutSection;
