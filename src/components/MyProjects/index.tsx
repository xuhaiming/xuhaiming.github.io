import { Card, CardHeader } from "@nextui-org/react";
import SectionLayout from "../SectionLayout";
import { ReactNode } from "react";

import Project1 from "./assets/project1.png";
import Project2 from "./assets/project2.png";
import Project3 from "./assets/project3.png";
import Project4 from "./assets/project4.png";

const projectCards = [
  {
    title: "PIM",
    description: "AI powered product information management system",
    image: Project1,
    bgColor: "bg-gradient-to-br from-[#1e3a8a] to-[#1e40af]",
  },
  {
    title: "E-Commerce",
    description: "E-Commerce buyer websites",
    image: Project2,
    bgColor: "bg-gradient-to-br from-[#334155] to-[#475569]",
  },
  {
    title: "Tax System",
    description:
      "Enterprise-grade tax management system developed for a leading US tax corporation",
    image: Project3,
    bgColor: "bg-gradient-to-br from-[#064e3b] to-[#065f46]",
  },
  {
    title: "AI Labelling",
    description: "Image, text, audio labelling platform",
    image: Project4,
    bgColor: "bg-gradient-to-br from-[#312e81] to-[#4338ca]",
  },
];

function ProjectCard({
  title,
  description,
  image,
  index,
  bgColor,
}: {
  title: ReactNode;
  description: ReactNode;
  image: string;
  index: number;
  bgColor: string;
}) {
  return (
    <div className="w-full col-span-12 sticky" style={{ top: 20 + index * 80 }}>
      <Card className={`pt-4 h-full mb-16 ${bgColor}`}>
        <CardHeader className="pb-0 pt-2 px-6 flex-col">
          <p className="text-lg uppercase font-bold self-start">{title}</p>
          <p className="text-sm self-start text-default-500 mb-4">
            {description}
          </p>
        </CardHeader>
        <div className="w-full h-full">
          <img
            alt="Card background"
            className="object-cover w-full h-full"
            src={image}
          />
        </div>
      </Card>
    </div>
  );
}

function MyProjects() {
  return (
    <SectionLayout title="My Projects" backgroundStyle="special">
      <div className="text-center text-black text-lg mb-24">
        <div>
          Throughout my development career, I have architected and implemented
          numerous full-stack solutions utilizing modern tech stacks. My
          technical portfolio includes developing distributed microservices
          architectures for e-commerce platforms and implementing complex data
          processing pipelines for enterprise tax computation systems.
        </div>

        <br />

        <div>
          My core competencies include developing scalable applications with
          React, Node.js, and cloud-native technologies. I have integrated
          machine learning models for data analysis, implemented RESTful and
          GraphQL APIs, and optimized system performance through efficient
          database design and caching strategies. My work emphasizes clean
          architecture principles, test-driven development, and CI/CD practices.
        </div>
      </div>
      <div>
        {projectCards.map((project, index) => (
          <ProjectCard
            key={project.title}
            title={project.title}
            description={project.description}
            image={project.image}
            index={index}
            bgColor={project.bgColor}
          />
        ))}
      </div>
    </SectionLayout>
  );
}

export default MyProjects;
