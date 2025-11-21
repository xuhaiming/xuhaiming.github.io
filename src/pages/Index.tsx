import React, { useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import MobileNotice from "@/components/MobileNotice";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import SkillsSection from "@/components/sections/SkillsSection";
import ProjectsSection from "@/components/sections/ProjectsSection";
import ContactSection from "@/components/sections/ContactSection";
import Footer from "@/components/Footer";

const Index = () => {
  const sectionRefs = useRef({
    hero: null,
    about: null,
    skills: null,
    projects: null,
    contact: null,
  });

  useEffect(() => {
    // This will update the page title
    document.title = "Haiming Pages | Creative Fullstack App Developer";

    // Smooth scroll behavior for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (
        anchor &&
        anchor.hash &&
        anchor.hash.startsWith("#") &&
        document.querySelector(anchor.hash)
      ) {
        e.preventDefault();
        const element = document.querySelector(anchor.hash);

        if (element) {
          window.scrollTo({
            behavior: "smooth",
            top: element.getBoundingClientRect().top + window.scrollY - 80,
          });
        }
      }
    };

    // Setup intersection observer for sections
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1,
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // When a section enters or leaves the viewport, trigger animation reset
        if (entry.target.id) {
          const sectionId = entry.target.id;
          // Set a custom attribute to track visibility state
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-in-view", "true");
          } else {
            entry.target.setAttribute("data-in-view", "false");
          }

          // Dispatch a custom event that the section can listen for
          const event = new CustomEvent("visibility-change", {
            detail: {
              isVisible: entry.isIntersecting,
            },
          });
          entry.target.dispatchEvent(event);
        }
      });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll("section[id]").forEach((section) => {
      sectionObserver.observe(section);
    });

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
      sectionObserver.disconnect();
    };
  }, []);

  return (
    <div className="overflow-hidden">
      <Navbar />
      <main className="md:mt-0 mt-16">
        <HeroSection ref={(el) => (sectionRefs.current.hero = el)} />
        <AboutSection ref={(el) => (sectionRefs.current.about = el)} />
        <SkillsSection ref={(el) => (sectionRefs.current.skills = el)} />
        <ProjectsSection ref={(el) => (sectionRefs.current.projects = el)} />
        <ContactSection ref={(el) => (sectionRefs.current.contact = el)} />
      </main>
      <Footer />
      <MobileNotice />
    </div>
  );
};

export default Index;
