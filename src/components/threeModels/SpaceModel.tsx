// import { Canvas, useLoader } from "@react-three/fiber";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import spaceModel from "./gltf/space/scene.gltf";
// import { OrbitControls } from "@react-three/drei";
// import { Suspense } from "react";

// export function SpaceModel() {
//   const gltf = useLoader(GLTFLoader, spaceModel);

//   return (
//     <Canvas
//       style={{ width: "80%", height: 500, margin: "0 auto" }}
//       shadows
//       camera={{ position: [1.97, 2.04, -2.98] }}
//     >
//       <Suspense fallback={null}>
//         <color attach="background" args={["black"]} />
//         <primitive object={gltf.scene} />

//         <OrbitControls enableZoom={true} autoRotate={false} />
//       </Suspense>
//     </Canvas>
//   );
// }
