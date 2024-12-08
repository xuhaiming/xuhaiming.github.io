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
    bgColor: "bg-gradient-to-br from-[#2d2a4a] to-[#3b3662]",
  },
  {
    title: "E-Commerce",
    description: "ToC E-Commerce marketplace websites like Shopee, Burberry",
    image: Project2,
    bgColor: "bg-gradient-to-br from-[#3d2f2a] to-[#4e3b33]",
  },
  {
    title: "Tax System",
    description:
      "Enterprise-grade tax management system developed for a leading US tax corporation",
    image: Project3,
    bgColor: "bg-gradient-to-br from-[#243a35] to-[#2d4a43]",
  },
  {
    title: "AI Labelling",
    description: "Image, text, audio labelling platform",
    image: Project4,
    bgColor: "bg-gradient-to-br from-[#1e2a3b] to-[#2a3b52]",
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
      <div className="text-center text-black text-lg mb-24 px-4">
        <div>
          Over the past several years, I have designed and built many successful
          full-stack applications using the latest technologies. I have created
          powerful e-commerce systems that work across multiple servers, and
          built advanced tax calculation systems that can handle large amounts
          of data quickly and accurately.
        </div>

        <br />

        <div>
          I am skilled at building fast and reliable web applications using
          React, Node.js, and cloud technologies. Recently, I have worked
          extensively with AI technologies, creating smart systems using GPT
          models, fine tuning AI to understand text and images, gathering web
          data automatically, and building smart search systems with RAG.
        </div>
      </div>
      <div className="px-4">
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
