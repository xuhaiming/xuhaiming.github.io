import React from "react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-space py-10 border-t border-neon-blue/10 relative overflow-hidden mb-16 md:mb-0">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-neon-blue/5 filter blur-3xl animate-pulse"
          style={{ animationDuration: "8s" }}
        ></div>
        <div
          className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-neon-purple/5 filter blur-3xl animate-pulse"
          style={{ animationDuration: "10s" }}
        ></div>
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end">
          <div className="mb-4 md:mb-0 relative">
            <a href="#" className="text-2xl font-bold text-gradient group">
              HaimingPages
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink group-hover:w-full transition-all duration-300 ease-out"></span>
            </a>
            <p className="text-white/60 mt-2">
              The 3D & AI Portfolio Website developed by Haiming Xu
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <p className="text-white/60">© {currentYear} All Rights Reserved</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
