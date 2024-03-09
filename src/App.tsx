import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Image,
  Divider,
  CardFooter,
  Link,
} from "@nextui-org/react";
import StarsModel from "./components/ThreeModels/StarsModel";
import {
  GalleryModel,
  galleryImages,
} from "./components/ThreeModels/GalleryModel";
import TechStacks from "./components/TechStacks";
import bg from "./assets/bg2.jpg";

function App() {
  return (
    <>
      <div className="relative flex h-screen content-center items-center justify-center pt-16 pb-32">
        <div className="absolute top-0 h-full w-full">
          <StarsModel />
        </div>
        <div className="absolute top-0 h-full w-full bg-black/60 bg-cover bg-center" />
        <div className="max-w-8xl container relative mx-auto">
          <div className="flex flex-wrap items-center">
            <div className="ml-auto mr-auto w-full px-4 text-center lg:w-8/12">
              <h1 className="mb-8 text-white text-5xl">Haiming Pages</h1>
              <h2 className="text-white text-base opacity-80">
                Welcome to my personal website created by Haiming Xu
              </h2>
            </div>
          </div>
        </div>
      </div>

      <TechStacks />

      <section className="hidden mt-32 bg-white px-4 pb-20 pt-4">
        <div className="container mx-auto">
          <div className="text-4xl text-center">About Me</div>
        </div>
        <div className="container mx-auto">
          <div className="mt-32 flex flex-wrap items-center">
            <div className="mx-auto w-full px-4 md:w-5/12">
              <div className="mb-3 font-bold" color="blue-gray">
                Working with us is a pleasure
              </div>

              <Card className="max-w-[400px] m-24">
                <CardHeader className="flex gap-3">
                  <Image
                    alt="nextui logo"
                    height={40}
                    radius="sm"
                    src="https://avatars.githubusercontent.com/u/86160567?s=200&v=4"
                    width={40}
                  />
                  <div className="flex flex-col">
                    <p className="text-md">NextUI</p>
                    <p className="text-small text-default-500">nextui.org</p>
                  </div>
                </CardHeader>
                <Divider />
                <CardBody>
                  <p>
                    Make beautiful websites regardless of your design
                    experience.
                  </p>
                </CardBody>
                <Divider />
                <CardFooter>
                  <Link
                    isExternal
                    showAnchorIcon
                    href="https://github.com/nextui-org/nextui"
                  >
                    Visit source code on GitHub.
                  </Link>
                </CardFooter>
              </Card>
              <div className="mb-8 font-normal text-blue-gray-500">
                Do not let your uses guess by attaching tooltips and popoves to
                any element. Just make sure you enable them first via
                JavaScript.
                <br />
                <br />
                The kit comes with three pre-built pages to help you get started
                faster. You can change the text and images and you are good to
                go. Just make sure you enable them first via JavaScript.
              </div>
              <Button>read more</Button>
            </div>
            <div className="mx-auto mt-24 flex w-full justify-center px-4 md:w-4/12 lg:mt-0">
              <Card className="shadow-lg border shadow-gray-500/10 rounded-lg">
                <CardHeader className="relative h-56">
                  <img alt="Card" src={bg} className="h-full w-full" />
                </CardHeader>
                <CardBody>
                  <div color="blue-gray" className="font-normal">
                    Enterprise
                  </div>
                  <div color="blue-gray" className="mb-3 mt-2 font-bold">
                    Top Notch Services
                  </div>
                  <div className="font-normal text-blue-gray-500">
                    The Arctic Ocean freezes every winter and much of the
                    sea-ice then thaws every summer, and that process will
                    continue whatever happens.
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="h-[300px] lg:h-[800px]">
        <GalleryModel images={galleryImages} />
      </div>

      <div className="py-8">
        <div className="block text-center text-gray-800 text-sm">
          © Haiming Pages {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
}

export default App;
