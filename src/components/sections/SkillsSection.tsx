import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Compass, Layers, ChartBar } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  Tooltip,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

const skills = [
  {
    category: "Frontend",
    icon: Code,
    color: "bg-gradient-to-br from-neon-blue to-neon-purple",
    chartColor: "#00EEFF",
    description:
      "Specializing in building responsive, interactive user interfaces with modern frameworks and libraries.",
    items: [
      {
        name: "React",
        value: 90,
        description:
          "Extensive experience with hooks, context API, and React Router",
      },
      {
        name: "Three.js",
        value: 80,
        description: "Creating immersive 3D scenes and animations for the web",
      },
      {
        name: "CSS/SASS",
        value: 85,
        description: "Advanced styling with animations and responsive design",
      },
      {
        name: "JavaScript",
        value: 95,
        description: "Expert knowledge of ES6+ features and best practices",
      },
      {
        name: "TypeScript",
        value: 85,
        description:
          "Building type-safe applications for better maintainability",
      },
      {
        name: "HTML5",
        value: 95,
        description: "Semantic markup and accessibility standards",
      },
    ],
  },
  {
    category: "Design",
    icon: Compass,
    color: "bg-gradient-to-br from-neon-purple to-neon-pink",
    chartColor: "#F471B5",
    description:
      "Creating visually appealing and user-friendly interfaces with a focus on user experience.",
    items: [
      {
        name: "UI/UX",
        value: 85,
        description: "User-centered design principles and interaction patterns",
      },
      {
        name: "Motion Graphics",
        value: 75,
        description: "Creating engaging animations and visual effects",
      },
      {
        name: "3D Modeling",
        value: 70,
        description: "Designing basic 3D assets for web applications",
      },
      {
        name: "Figma",
        value: 90,
        description: "Collaborative design and prototyping workflows",
      },
      {
        name: "Adobe Suite",
        value: 80,
        description:
          "Photoshop, Illustrator, and After Effects for graphic design",
      },
    ],
  },
  {
    category: "Backend",
    icon: Layers,
    color: "bg-gradient-to-br from-neon-pink to-neon-blue",
    chartColor: "#8B5CF6",
    description:
      "Building robust server-side applications with modern technologies and best practices.",
    items: [
      {
        name: "Node.js",
        value: 80,
        description: "Server-side JavaScript with Express and RESTful APIs",
      },
      {
        name: "Express",
        value: 85,
        description: "Creating scalable web applications and APIs",
      },
      {
        name: "MongoDB",
        value: 75,
        description: "Document-based database design and optimization",
      },
      {
        name: "GraphQL",
        value: 70,
        description: "Building efficient APIs with precise data fetching",
      },
      {
        name: "Firebase",
        value: 85,
        description: "Real-time databases, authentication, and cloud functions",
      },
    ],
  },
];

// Define EnhancedRadarChart props
interface EnhancedRadarChartProps {
  data: SkillItem[];
  color: string;
  categoryName: string;
  isVisible: boolean;
}

const EnhancedRadarChart = ({
  data,
  color,
  categoryName,
  isVisible,
}: EnhancedRadarChartProps) => {
  const [activeSkill, setActiveSkill] = useState<SkillItem | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Reset animation when visibility changes
  useEffect(() => {
    if (isVisible && chartRef.current) {
      // Force re-render of chart when becoming visible
      const timer = setTimeout(() => {
        setActiveSkill(null); // Reset any active skill
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <div className="relative" ref={chartRef}>
      <ResponsiveContainer width="100%" height={isMobile ? 290 : 500}>
        <RadarChart outerRadius={isMobile ? 80 : 180} data={data}>
          <PolarGrid stroke="#333445" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: "#ffffff", fontSize: 12 }}
          />
          <Radar
            name={categoryName}
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.6}
            animationDuration={1500}
            animationEasing="ease-out"
            isAnimationActive={true}
            onMouseEnter={(data, index) =>
              setActiveSkill(data.payload as SkillItem)
            }
            onMouseLeave={() => setActiveSkill(null)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(20, 20, 50, 0.9)",
              borderColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              color: "#ffffff",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
            itemStyle={{ color: "#ffffff" }}
            labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
            formatter={(value) => [`${value}%`, "Proficiency"]}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>

      {activeSkill && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-0 left-0 right-0 bg-space-dark/80 backdrop-blur-sm p-3 rounded-md border border-white/10 text-center"
        >
          <p className="font-medium text-neon-blue">{activeSkill.name}</p>
          <p className="text-xs text-white/70">{activeSkill.description}</p>
        </motion.div>
      )}
    </div>
  );
};

interface SkillLevelIndicatorProps {
  level: number;
}

const SkillLevelIndicator = ({ level }: SkillLevelIndicatorProps) => {
  const levels = [
    { range: [0, 60], label: "Beginner", color: "bg-red-500" },
    { range: [61, 75], label: "Intermediate", color: "bg-yellow-500" },
    { range: [76, 85], label: "Advanced", color: "bg-green-500" },
    { range: [86, 100], label: "Expert", color: "bg-neon-blue" },
  ];

  const currentLevel = levels.find(
    (l) => level >= l.range[0] && level <= l.range[1]
  );

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className={`w-2 h-2 rounded-full ${currentLevel?.color}`}></div>
      <span className="text-xs text-white/80">{currentLevel?.label}</span>
      <span className="text-xs font-medium ml-auto">{level}%</span>
    </div>
  );
};

// Define the skill item type
interface SkillItem {
  name: string;
  value: number;
  description: string;
}

// Define the skill category type
interface SkillCategory {
  category: string;
  icon: React.ElementType;
  color: string;
  chartColor: string;
  description: string;
  items: SkillItem[];
}

// Define the skill button props
interface SkillCategoryButtonProps {
  skill: SkillCategory;
  isSelected: boolean;
  onClick: () => void;
}

const SkillCategoryButton = ({
  skill,
  isSelected,
  onClick,
}: SkillCategoryButtonProps) => {
  return (
    <motion.button
      key={skill.category}
      onClick={onClick}
      className="px-6 py-2 rounded-full relative flex items-center gap-2 overflow-hidden"
      initial={{ opacity: 0.8 }}
      whileHover={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Background and border container */}
      <AnimatePresence mode="wait">
        {isSelected ? (
          <motion.div
            key="selected"
            className="absolute inset-0 bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-white/20 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            layoutId={`button-bg-${skill.category}`}
          />
        ) : (
          <motion.div
            key="unselected"
            className="absolute inset-0 bg-space-light/30 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            layoutId={`button-bg-${skill.category}`}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <skill.icon className="w-4 h-4 relative z-10" />
      <span
        className={`relative z-10 ${
          isSelected ? "text-white" : "text-white/70"
        }`}
      >
        {skill.category}
      </span>
    </motion.button>
  );
};

const SkillsSection = forwardRef((props, ref) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Frontend");
  const [sectionHeight, setSectionHeight] = useState<number | null>(null);
  const isMobile = useIsMobile();

  // Expose the section ref
  useImperativeHandle(ref, () => sectionRef.current);

  // Measure and maintain section height on mobile
  useEffect(() => {
    if (isMobile && sectionRef.current && inView) {
      const height = sectionRef.current.scrollHeight;
      setSectionHeight(height);
    }
  }, [isMobile, inView, selectedCategory]);

  // Reset animations when visibility changes
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleVisibilityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setInView(customEvent.detail.isVisible);
    };

    section.addEventListener("visibility-change", handleVisibilityChange);
    return () => {
      section.removeEventListener("visibility-change", handleVisibilityChange);
    };
  }, []);

  // Get selected skill category
  const selectedSkill =
    skills.find((skill) => skill.category === selectedCategory) || skills[0];

  // Generate particles once and memoize them
  const particles = useMemo(() => {
    return [...Array(200)].map((_, i) => ({
      id: `particle-${i}`,
      width: Math.random() * 6 + 2,
      height: Math.random() * 6 + 2,
      color: i % 3 === 0 ? "#00EEFF" : i % 3 === 1 ? "#F471B5" : "#8B5CF6",
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: Math.random() * 5 + 5,
      delay: Math.random() * 5,
    }));
  }, []);

  // Dynamic style for maintaining height on mobile
  const sectionStyle = useMemo(() => {
    if (isMobile && sectionHeight && !inView) {
      return {
        height: `${sectionHeight}px`,
        minHeight: "auto",
      };
    }
    return {
      minHeight: "100vh",
    };
  }, [isMobile, sectionHeight, inView]);

  return (
    <section
      id="skills"
      className="py-20 md:py-32 relative bg-gradient-to-b from-space-dark via-space to-space-dark"
      ref={sectionRef}
      data-in-view={inView ? "true" : "false"}
      style={sectionStyle}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gNTAgMCBMIDAgMCAwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzM0NDUiIHN0cm9rZS13aWR0aD0iMC41Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />

        {/* Floating particles effect - reduced on mobile */}
        <div className="absolute inset-0">
          {particles
            .slice(0, window.innerWidth < 768 ? 50 : 200)
            .map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full opacity-30"
                style={{
                  width: particle.width + "px",
                  height: particle.height + "px",
                  backgroundColor: particle.color,
                  left: particle.left + "%",
                  top: particle.top + "%",
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.2, 0.8, 0.2],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: particle.delay,
                }}
              />
            ))}
        </div>
      </div>

      {/* Content container with consistent height */}
      <div className="container mx-auto px-4 relative z-20 h-full flex flex-col">
        {/* Always render content structure to maintain height */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : -20 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-8 md:mb-10"
        >
          <div className="inline-block mb-2">
            <motion.div
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-neon-blue/20 flex items-center justify-center border border-neon-blue/40 mb-4 mx-auto"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 1, ease: "easeInOut" }}
            >
              <ChartBar className="w-5 h-5 md:w-6 md:h-6 text-neon-blue" />
            </motion.div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-6xl font-bold mb-4 md:mb-6">
            <span className="text-gradient">My Skills</span>
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto mb-4 md:mb-6 text-sm md:text-base px-4">
            An interactive visualization of my technical expertise across
            various domains. Hover over the radar chart to see detailed
            information about each skill.
          </p>
          <div className="w-16 md:w-20 h-1 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink mx-auto rounded-full" />

          <div className="mt-6 md:mt-8 flex justify-center gap-2 md:gap-3 flex-wrap px-4">
            {skills.map((skill) => (
              <SkillCategoryButton
                key={skill.category}
                skill={skill}
                isSelected={selectedCategory === skill.category}
                onClick={() => setSelectedCategory(skill.category)}
              />
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-12 flex-1">
          <motion.div
            className="lg:col-span-2 order-2 lg:order-1"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : -30 }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 100,
            }}
          >
            <Card className="bg-space-light/60 backdrop-blur-lg border border-white/10 overflow-hidden h-full transform-gpu relative">
              <div
                className={`absolute inset-0 opacity-10 ${selectedSkill.color} transition-colors duration-500`}
              />

              <CardHeader className="border-b border-white/5 relative z-10 p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 md:p-3 rounded-full ${selectedSkill.color} text-white`}
                    >
                      <selectedSkill.icon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <CardTitle className="text-xl md:text-2xl font-bold">
                      {selectedSkill.category}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 md:pt-8 relative p-2 md:p-6">
                <div
                  style={{
                    height: window.innerWidth < 768 ? "300px" : "500px",
                  }}
                >
                  {inView && (
                    <EnhancedRadarChart
                      key={`${selectedSkill.category}-${inView}`}
                      data={selectedSkill.items}
                      color={selectedSkill.chartColor}
                      categoryName={selectedSkill.category}
                      isVisible={inView}
                    />
                  )}
                </div>
              </CardContent>

              <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-tr from-white/5 to-transparent blur-2xl" />
            </Card>
          </motion.div>

          <motion.div
            className="space-y-4 order-1 lg:order-2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : 30 }}
            transition={{
              duration: 0.5,
              delay: 0.1,
              type: "spring",
              stiffness: 100,
            }}
            key={`skill-breakdown-${selectedSkill.category}-${inView}`}
          >
            <Card className="bg-space-light/60 backdrop-blur-lg border border-white/10 overflow-hidden h-auto">
              <CardHeader className="border-b border-white/5 p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl">
                  Skill Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-4 md:p-6">
                <div className="space-y-3 md:space-y-4">
                  {selectedSkill.items.map((item, index) => (
                    <motion.div
                      key={`${item.name}-${inView}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : 20 }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.3,
                        ease: "easeOut",
                      }}
                      className="p-3 bg-space/50 rounded-lg border border-white/5 hover:border-white/20 transition-all"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-medium text-sm md:text-base">
                          {item.name}
                        </h4>
                      </div>

                      <div className="w-full h-2 bg-space-dark rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: selectedSkill.chartColor,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: inView ? `${item.value}%` : 0 }}
                          transition={{
                            duration: 0.8,
                            delay: 0.2 + index * 0.05,
                            ease: "easeOut",
                          }}
                        />
                      </div>

                      <SkillLevelIndicator level={item.value} />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

SkillsSection.displayName = "SkillsSection";
export default SkillsSection;
