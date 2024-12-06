import StarsModel from "../components/threeModels/StarsModel";
// import {
//   GalleryModel,
//   galleryImages,
// } from "../components/threeModels/GalleryModel";
import TechStacks from "../components/TechStacks";
import MyProjects from "../components/MyProjects";
import AboutMe from "../components/AboutMe";
import MyProfile from "../components/MyProfile";

function Home() {
  return (
    <>
      <div className="relative flex h-screen content-center items-center justify-center pt-16 pb-32">
        <div className="absolute top-0 h-full w-full">
          <StarsModel />
        </div>
      </div>

      <TechStacks />

      <MyProfile />

      <MyProjects />

      {/* <div className="h-[300px] lg:h-[800px]">
        <GalleryModel images={galleryImages} />
      </div> */}

      <AboutMe />

      <div className="py-8 bg-gray-900">
        <div className="block text-center text-gray-50 text-sm">
          © Haiming Pages {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
}

export default Home;
