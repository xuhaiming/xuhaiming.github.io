import bg from "./assets/haiming_linkedin.png";
import SectionLayout from "../SectionLayout";

function AboutMe() {
  return (
    <SectionLayout title="About Me">
      <div className="container mx-auto">
        <div className="mt-32 flex flex-wrap items-start">
          <div className="mx-auto w-full px-4 md:w-5/12">
            <div className="mb-3 font-bold text-gray-800">
              Working experience
            </div>

            <div className="mb-8 font-normal text-gray-800">
              I am currently serving as the Lead Frontend Engineer at Trustana,
              where I spearhead the development of AI-driven applications.
              <br />
              <br />
              Throughout my career, I have collaborated with renowned companies
              such as Shopee, Tencent, ThoughtWorks, Phillips, and more.
              <br />
              <br />
              My expertise predominantly lies in frontend technologies including
              React, Next.js, and Node.js. However, I also possess substantial
              experience with backend and AI-related technologies such as
              serverless architecture, MongoDB, AI agents leveraging OpenAI
              APIs, RAG, and model fine-tuning.
              <br />
              <br />
              Additionally, I have contributed to AI-driven image and video
              generation projects using advanced tools such as Stable Diffusion
              (SD1.5, SDXL, Flux). I have also worked extensively with ComfyUI
              workflows, including Lora training, ControlNet, IP Adapter, etc.
            </div>
          </div>
          <div className="mx-auto mt-24 flex w-full justify-center px-4 md:w-4/12 lg:mt-0">
            <div className="shadow-lg border shadow-gray-500/10 rounded-lg">
              <div className="relative">
                <img
                  alt="Card"
                  src={bg}
                  className="h-full w-full min-w-[400px] min-h-[400px]"
                />
                <div className="text-gray-800 text-center mt-2 pt-2 pb-4">
                  My Linkedin QR Code
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionLayout>
  );
}

export default AboutMe;
