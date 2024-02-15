import {
  Card,
  CardBody,
  CardHeader,
  Typography,
  Button,
} from "@material-tailwind/react";
import { FingerPrintIcon } from "@heroicons/react/24/solid";
import { PageTitle } from "./widgets/layout";
import { motion, useScroll } from "framer-motion";
import bg from "./assets/bg2.jpg";
import { Canvas, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import spaceModel from "./models/need_some_space/scene.gltf";
import shibaModel from "./models/shiba/scene.gltf";
import shibaTexture from "./models/shiba/textures/default_baseColor.png";
import { TextureLoader } from "three/src/loaders/TextureLoader";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useState, useRef } from "react";
import * as THREE from "three";

function App() {
  const { scrollYProgress } = useScroll();
  const [key, setKey] = useState(Math.random().toString());
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(5);
  const boundingBox = new THREE.Box3();
  const boundingBoxSize = new THREE.Vector3();

  const mershRef = useRef();
  let boxSize = { x: 0, y: 0 };
  if (mershRef.current) {
    boundingBox.setFromObject(mershRef.current);
    boxSize = boundingBox.getSize(boundingBoxSize);
    console.log(boxSize);
    setX(boxSize.x / 2);
    setY(boxSize.y / 2);
  }

  const gltf = useLoader(GLTFLoader, spaceModel);
  const texture = useLoader(TextureLoader, shibaTexture);

  console.log(scrollYProgress);

  return (
    <>
      <Button
        onClick={() => {
          setX(x + 0.1);
          setKey(Math.random().toString());
        }}
      >
        X+
      </Button>
      <Button
        onClick={() => {
          setX(x - 0.1);
          setKey(Math.random().toString());
        }}
      >
        X-
      </Button>
      <Button
        onClick={() => {
          setY(y + 0.1);
          setKey(Math.random().toString());
        }}
      >
        Y+
      </Button>
      <Button
        onClick={() => {
          setY(y - 0.1);
          setKey(Math.random().toString());
        }}
      >
        Y-
      </Button>
      <Button
        onClick={() => {
          setZ(z + 0.1);
          setKey(Math.random().toString());
        }}
      >
        Z+
      </Button>
      <Button
        onClick={() => {
          setZ(z - 0.1);
          setKey(Math.random().toString());
        }}
      >
        Z-
      </Button>

      <div>
        <div>X: {x}</div>
        <div>Y: {y}</div>
        <div>Z: {z}</div>
      </div>
      {/* <Canvas
        key={key}
        style={{ width: "80%", height: 500, margin: "0 auto" }}
        shadows
        camera={{ position: [2.0, 2.1, -1.8] }}
      >
        <ambientLight color={"red"} />
        <directionalLight
          color={"orange"}
          position={[2.0, 2.1, -1.8]}
          castShadow
        />
        <pointLight color={"yellow"} position={[2.0, 2.1, -1.8]} />
        <spotLight color={"white"} position={[2.0, 2.1, -1.8]} />
        <rectAreaLight color={"blue"} position={[2.0, 2.1, -1.8]} />
        <color attach="background" args={["black"]} />
        <primitive object={gltf.scene} />
      </Canvas> */}

      <Canvas
        key={key}
        style={{ width: "80%", height: 500, margin: "0 auto" }}
        shadows
        camera={{ position: [x, y, z] }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["black"]} />
          <ambientLight intensity={0.2} />
          <directionalLight />
          <spotLight
            angle={0.14}
            color="#ffffff"
            penumbra={1}
            position={[0, 0, 0]}
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
            castShadow
          />
          <mesh>
            <primitive object={gltf.scene} />
            <meshStandardMaterial displacementScale={0.2} map={texture} />
          </mesh>
          <OrbitControls enableZoom={true} autoRotate={false} />
        </Suspense>
      </Canvas>

      <div className="mt-32 relative flex h-screen content-center items-center justify-center pt-16 pb-32">
        <div
          className={`absolute top-0 h-full w-full bg-cover bg-center`}
          style={{ backgroundImage: `url("${bg}")` }}
        />
        <div className="absolute top-0 h-full w-full bg-black/60 bg-cover bg-center" />
        <div className="max-w-8xl container relative mx-auto">
          <div className="flex flex-wrap items-center">
            <div className="ml-auto mr-auto w-full px-4 text-center lg:w-8/12">
              <Typography
                variant="h1"
                color="white"
                className="mb-6 font-black"
              >
                Haiming Pages
              </Typography>
              <Typography variant="lead" color="white" className="opacity-80">
                Welcome to the personal website created by Haiming Xu
              </Typography>
            </div>
          </div>
        </div>
      </div>

      {/* <div className="p-24 m-32">
        test
        <motion.div
          className="w-[100px] h-[100px] bg-red-700"
          // style={{width:200, height:200, background: "red"}}
          animate={{
            scale: [1, 2, 2, 1, 1],
            rotate: [0, 0, 180, 180, 0],
            borderRadius: ["0%", "0%", "50%", "50%", "0%"]
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            times: [0, 0.2, 0.5, 0.8, 1],
            repeat: Infinity,
            repeatDelay: 0
          }}
        />
      </div> */}

      <section className="-mt-32 bg-white px-4 pb-20 pt-4">
        <div className="container mx-auto">
          <div className="mt-32 flex flex-wrap items-center">
            <div className="mx-auto -mt-8 w-full px-4 md:w-5/12">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-gray-900 p-2 text-center shadow-lg">
                <FingerPrintIcon className="h-8 w-8 text-white " />
              </div>
              <Typography
                variant="h3"
                className="mb-3 font-bold"
                color="blue-gray"
              >
                Working with us is a pleasure
              </Typography>
              <Typography className="mb-8 font-normal text-blue-gray-500">
                Don't let your uses guess by attaching tooltips and popoves to
                any element. Just make sure you enable them first via
                JavaScript.
                <br />
                <br />
                The kit comes with three pre-built pages to help you get started
                faster. You can change the text and images and you're good to
                go. Just make sure you enable them first via JavaScript.
              </Typography>
              <Button variant="filled">read more</Button>
            </div>
            <div className="mx-auto mt-24 flex w-full justify-center px-4 md:w-4/12 lg:mt-0">
              <Card className="shadow-lg border shadow-gray-500/10 rounded-lg">
                <CardHeader floated={false} className="relative h-56">
                  <img alt="Card Image" src={bg} className="h-full w-full" />
                </CardHeader>
                <CardBody>
                  <Typography
                    variant="small"
                    color="blue-gray"
                    className="font-normal"
                  >
                    Enterprise
                  </Typography>
                  <Typography
                    variant="h5"
                    color="blue-gray"
                    className="mb-3 mt-2 font-bold"
                  >
                    Top Notch Services
                  </Typography>
                  <Typography className="font-normal text-blue-gray-500">
                    The Arctic Ocean freezes every winter and much of the
                    sea-ice then thaws every summer, and that process will
                    continue whatever happens.
                  </Typography>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-20 pb-48">
        <div className="container mx-auto">
          <PageTitle section="Our Team" heading="Here are our heroes">
            According to the National Oceanic and Atmospheric Administration,
            Ted, Scambos, NSIDClead scentist, puts the potentially record
            maximum.
          </PageTitle>
        </div>
      </section>
      <section className="relative bg-white py-24 px-4">
        <div className="container mx-auto">
          <PageTitle section="Co-Working" heading="Build something">
            Put the potentially record low maximum sea ice extent tihs year down
            to low ice. According to the National Oceanic and Atmospheric
            Administration, Ted, Scambos.
          </PageTitle>

          <PageTitle section="Contact Us" heading="Want to work with us?">
            Complete this form and we will get back to you in 24 hours.
          </PageTitle>
        </div>
      </section>
      <div className="bg-white">{/* <Footer /> */}</div>
    </>
  );
}

export default App;
