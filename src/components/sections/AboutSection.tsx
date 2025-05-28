import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import ThreeScene from "../ThreeScene";
import VideoSkeleton from "../VideoSkeleton";
import VideoFallback from "../VideoFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useMobileVideo } from "@/hooks/use-mobile-video";

const AboutSection = forwardRef((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoCanPlay, setVideoCanPlay] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Use mobile video hook for better mobile support
  const {
    isMobileDevice,
    isIOSDevice,
    canAutoplay,
    getVideoAttributes,
    getVideoStyles,
    playVideo,
  } = useMobileVideo();

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
        // Reset animations when section becomes visible
        if (imageRef.current) {
          imageRef.current.style.transform = "translateY(0)";
        }

        // Reset text animations
        textRefs.current.forEach((textRef, index) => {
          if (textRef) {
            textRef.style.opacity = "0";
            textRef.style.transform = "translateY(30px)";
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
      if (!containerRef.current || !isVisible) return;

      const rect = containerRef.current.getBoundingClientRect();
      const scrollPercentage = Math.min(
        Math.max(
          (window.innerHeight - rect.top) / (window.innerHeight + rect.height),
          0
        ),
        1
      );

      // Parallax for image
      if (imageRef.current) {
        imageRef.current.style.transform = `translateY(${
          scrollPercentage * -50
        }px)`;
      }

      // Staggered text animation
      textRefs.current.forEach((textRef, index) => {
        if (textRef) {
          const delay = index * 0.1;
          const startPoint = delay;
          const endPoint = startPoint + 0.3;

          let opacity = 0;
          let translateY = 30;

          if (scrollPercentage > startPoint) {
            const textScrollPercentage = Math.min(
              (scrollPercentage - startPoint) / (endPoint - startPoint),
              1
            );
            opacity = textScrollPercentage;
            translateY = 30 * (1 - textScrollPercentage);
          }

          textRef.style.opacity = opacity.toString();
          textRef.style.transform = `translateY(${translateY}px)`;
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    // Call immediately to set initial state
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isVisible]);

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
    if (isVisible && videoRef.current && videoCanPlay) {
      playVideo(videoRef.current);
    }
  }, [isVisible, videoCanPlay, playVideo]);

  // Function to retry video loading
  const retryVideo = () => {
    setVideoError(false);
    setVideoLoaded(false);
    setVideoCanPlay(false);

    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  return (
    <section
      id="about"
      ref={sectionRef}
      className="min-h-screen py-20 relative bg-space"
      data-in-view={isVisible ? "true" : "false"}
    >
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-space-dark to-transparent z-10" />

      <div className="container mx-auto px-4 relative z-20" ref={containerRef}>
        <h2 className="text-3xl md:text-5xl font-bold mb-16 text-gradient text-center">
          About Me
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="md:order-2 relative h-[500px] w-full">
            <div className="absolute inset-0">
              <ThreeScene sceneType="about" />
            </div>

            <div
              ref={imageRef}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            />
          </div>

          <div className="md:order-1 space-y-6">
            {[
              "I am currently serving as the Lead Frontend Engineer at Trustana, where I spearhead the development of AI-driven applications.",
              "Throughout my career, I have collaborated with renowned companies such as Shopee, Tencent, Burberry, ThoughtWorks, Phillips, and more.",
              "My expertise predominantly lies in frontend technologies including React, Next.js, and Node.js. However, I also possess substantial experience with backend and AI-related technologies such as AWS serverless architecture, MongoDB, AI agents leveraging OpenAI APIs, Gemini, RAG, and prompt engineering.",
              "Additionally, I have contributed to AI-driven image, 3D and video generation projects using advanced tools such as Stable Diffusion, Hunyuan, Wan 2.1, Flux. I have also worked extensively with ComfyUI workflows, including Lora, ControlNet, IP Adapter, etc.",
            ].map((text, index) => (
              <p
                key={index}
                ref={(el) => (textRefs.current[index] = el)}
                className="text-lg opacity-0 transition-all duration-500"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {text}
              </p>
            ))}

            <div
              ref={(el) => (textRefs.current[4] = el)}
              className="flex flex-wrap gap-3 opacity-0 transition-all duration-500"
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
                  className="bg-space-light px-3 py-1 rounded-full text-sm text-neon-blue"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Video Section */}
        <div className="mt-24 mb-8">
          <h3 className="text-2xl md:text-3xl font-bold mb-8 text-gradient text-center">
            See My Work In Action
          </h3>

          <div className="max-w-4xl mx-auto">
            <AspectRatio
              ratio={16 / 9}
              className="bg-space-light rounded-lg overflow-hidden relative"
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
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-space-dark to-transparent z-10" />
    </section>
  );
});

AboutSection.displayName = "AboutSection";
export default AboutSection;
