import { useEffect, useState, useCallback } from "react";

interface MobileVideoOptions {
  enableAutoplay?: boolean;
  enableMuted?: boolean;
  enablePlaysInline?: boolean;
}

export function useMobileVideo(options: MobileVideoOptions = {}) {
  const {
    enableAutoplay = true,
    enableMuted = true,
    enablePlaysInline = true,
  } = options;

  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [canAutoplay, setCanAutoplay] = useState(false);

  // Detect mobile and iOS devices
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);

    setIsMobileDevice(isMobile);
    setIsIOSDevice(isIOS);
  }, []);

  // Test autoplay capability
  useEffect(() => {
    const testAutoplay = async () => {
      try {
        const video = document.createElement("video");
        video.muted = enableMuted;
        video.playsInline = enablePlaysInline;
        video.autoplay = enableAutoplay;

        // Create a minimal video data URL for testing
        video.src =
          "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzEAAAAIZnJlZQAAABBtZGF0AAAA";

        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
          setCanAutoplay(true);
        }
      } catch (error) {
        console.log("Autoplay test failed:", error);
        setCanAutoplay(false);
      }
    };

    if (enableAutoplay) {
      testAutoplay();
    }
  }, [enableAutoplay, enableMuted, enablePlaysInline]);

  // Get optimal video attributes for current device
  const getVideoAttributes = useCallback(() => {
    const attributes: Record<string, any> = {
      playsInline: true,
      muted: true,
      controls: false,
      disablePictureInPicture: true,
      disableRemotePlayback: true,
      preload: "metadata",
    };

    // iOS-specific attributes
    if (isIOSDevice) {
      attributes["webkit-playsinline"] = "true";
      attributes["x5-playsinline"] = "true";
      attributes["x5-video-player-type"] = "h5";
      attributes["x5-video-player-fullscreen"] = "false";
    }

    // Android-specific attributes
    if (isMobileDevice && !isIOSDevice) {
      attributes["x5-playsinline"] = "true";
      attributes["x5-video-player-type"] = "h5";
    }

    // Only add autoplay if it's supported
    if (canAutoplay && enableAutoplay) {
      attributes.autoPlay = true;
    }

    return attributes;
  }, [isMobileDevice, isIOSDevice, canAutoplay, enableAutoplay]);

  // Get optimal video styles for mobile
  const getVideoStyles = useCallback(() => {
    return {
      userSelect: "none" as const,
      WebkitUserSelect: "none" as const,
      pointerEvents: isMobileDevice ? ("none" as const) : ("auto" as const),
      WebkitTouchCallout: "none" as const,
      WebkitUserDrag: "none" as const,
    };
  }, [isMobileDevice]);

  // Enhanced play function with mobile fallbacks
  const playVideo = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!videoElement) return false;

    try {
      // Reset video to beginning
      videoElement.currentTime = 0;

      // Ensure video is muted for autoplay
      if (!videoElement.muted) {
        videoElement.muted = true;
      }

      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log("Video play successful");
        return true;
      }
    } catch (error) {
      console.log("Video play failed:", error);

      // Try fallback strategies
      try {
        videoElement.muted = true;
        videoElement.playsInline = true;
        await videoElement.play();
        console.log("Video play successful with fallback");
        return true;
      } catch (fallbackError) {
        console.log("Video play failed even with fallback:", fallbackError);
        return false;
      }
    }

    return false;
  }, []);

  return {
    isMobileDevice,
    isIOSDevice,
    canAutoplay,
    getVideoAttributes,
    getVideoStyles,
    playVideo,
  };
}
