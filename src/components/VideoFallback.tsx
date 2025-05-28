import React from "react";
import { Play, AlertCircle } from "lucide-react";

interface VideoFallbackProps {
  onRetry?: () => void;
  message?: string;
}

const VideoFallback: React.FC<VideoFallbackProps> = ({
  onRetry,
  message = "Video unavailable on this device",
}) => {
  return (
    <div className="relative w-full h-full bg-space-light rounded-lg overflow-hidden flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-space-light via-space to-space-dark opacity-80" />

      {/* Content */}
      <div className="relative z-10 text-center p-8">
        <div className="mb-4">
          <AlertCircle className="w-12 h-12 text-neon-blue mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Video Not Available
          </h3>
          <p className="text-sm text-gray-300 mb-4">{message}</p>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neon-blue/20 hover:bg-neon-blue/30 border border-neon-blue/50 rounded-lg text-neon-blue transition-colors duration-200"
          >
            <Play className="w-4 h-4" />
            Try Again
          </button>
        )}

        {/* Decorative elements */}
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-neon-blue/30 rounded-tr-lg" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-neon-blue/30 rounded-bl-lg" />
      </div>
    </div>
  );
};

export default VideoFallback;
