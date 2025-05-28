import React, { useState } from "react";
import { Monitor, X } from "lucide-react";

const MobileNotice = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gradient-to-r from-neon-blue/20 via-neon-purple/20 to-neon-pink/20 backdrop-blur-sm border-b border-neon-blue/30">
      <div className="flex items-center justify-between p-3 px-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-neon-blue/20 p-2 rounded-full">
            <Monitor className="h-4 w-4 text-neon-blue" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">
              Better Experience on Desktop
            </p>
            <p className="text-white/70 text-xs">
              View on PC for full interactive features
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNotice;
