import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const VideoSkeleton = () => {
  return (
    <div className="relative w-full h-full bg-space-light rounded-lg overflow-hidden">
      {/* Main video skeleton */}
      <Skeleton className="w-full h-full bg-gradient-to-br from-space-light via-space to-space-dark" />

      {/* Animated play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Pulsing outer ring */}
          <div className="absolute inset-0 w-20 h-20 border-2 border-neon-blue/30 rounded-full animate-ping" />
          <div className="absolute inset-2 w-16 h-16 border-2 border-neon-blue/50 rounded-full animate-ping video-skeleton-delay-200" />

          {/* Loading spinner */}
          <div className="relative w-20 h-20 bg-neon-blue/20 backdrop-blur-sm border border-neon-blue/50 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
          </div>
        </div>
      </div>

      {/* Loading progress bar */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 h-2 bg-space-dark/50 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-neon-blue to-purple-500 rounded-full animate-pulse w-1/3" />
          </div>
          <span className="text-sm text-neon-blue animate-pulse">
            Loading...
          </span>
        </div>
      </div>

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 video-skeleton-shimmer" />

      {/* Corner elements for visual appeal */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-neon-blue/30 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-neon-blue/30 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-neon-blue/30 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-neon-blue/30 rounded-br-lg" />
    </div>
  );
};

export default VideoSkeleton;
