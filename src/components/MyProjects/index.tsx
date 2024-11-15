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
  },
  {
    title: "E-Commerce",
    description: "E-Commerce buyer websites",
    image: Project2,
  },
  {
    title: "Tax System",
    description:
      "Enterprise-grade tax management system developed for a leading US tax corporation",
    image: Project3,
  },
  {
    title: "AI Labelling",
    description: "Image, text, audio labelling platform",
    image: Project4,
  },
];

function ProjectCard({
  title,
  description,
  image,
  index,
}: {
  title: ReactNode;
  description: ReactNode;
  image: string;
  index: number;
}) {
  return (
    <div className="w-full col-span-12 sticky" style={{ top: 20 + index * 80 }}>
      <Card className="pt-4 h-full mb-16 bg-gray-950">
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
    <SectionLayout title="My Projects" backgroundStyle="dark">
      <div>
        {projectCards.map((project, index) => (
          <ProjectCard
            key={project.title}
            title={project.title}
            description={project.description}
            image={project.image}
            index={index}
          />
        ))}
      </div>
    </SectionLayout>
  );
}

export default MyProjects;
