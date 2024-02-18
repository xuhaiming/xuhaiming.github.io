/* eslint-disable react/no-unknown-property, react/prop-types */
import { Quaternion, Vector3 } from "three";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useCursor,
  MeshReflectorMaterial,
  Image,
  Text,
  Environment,
} from "@react-three/drei";
import { easing } from "maath";
import thoughtworksImg from "./assets/thoughtworks.jpeg";
import epamImg from "./assets/epam.jpeg";
import tencentImg from "./assets/tencent.jpeg";
import shopeeImg from "./assets/shopee.jpeg";
import trustanaImg from "./assets/trustana.jpeg";

interface ImageItem {
  position: [number, number, number];
  rotation: [number, number, number];
  url: string;
  name: string;
}

// const GOLDENRATIO = 1.61803398875;
const GOLDENRATIO = 1;

export const galleryImages: ImageItem[] = [
  // Front
  {
    position: [0, 0, 1.5],
    rotation: [0, 0, 0],
    url: tencentImg,
    name: "Tencent (2017 - 2020)",
  },

  // Left
  {
    position: [-2, 0, 2.75],
    rotation: [0, Math.PI / 2.5, 0],
    url: thoughtworksImg,
    name: "ThoughtWorks (2014 - 2015)",
  },
  {
    position: [-1.75, 0, 0.25],
    rotation: [0, Math.PI / 2.5, 0],
    url: epamImg,
    name: "EPAM (2015 - 2017)",
  },
  // Right
  {
    position: [1.75, 0, 0.25],
    rotation: [0, -Math.PI / 2.5, 0],
    url: shopeeImg,
    name: "Shopee (2020 - 2023)",
  },
  {
    position: [2, 0, 2.75],
    rotation: [0, -Math.PI / 2.5, 0],
    url: trustanaImg,
    name: "Trustana (2023 - 2024)",
  },
];

function Frame({
  url,
  name,
  selectedId,
  ...props
}: {
  url: string;
  name: string;
  selectedId: string;
}) {
  const image = useRef<any>();
  const frame = useRef<any>();
  const [hovered, hover] = useState(false);
  const [rnd] = useState(() => Math.random());
  const isActive = selectedId === name;
  useCursor(hovered);
  useFrame((state, dt) => {
    image.current.material.zoom =
      2 + Math.sin(rnd * 10000 + state.clock.elapsedTime / 3) / 2;
    easing.damp3(
      image.current.scale,
      [
        0.85 * (!isActive && hovered ? 0.85 : 1),
        0.9 * (!isActive && hovered ? 0.905 : 1),
        1,
      ],
      0.1,
      dt
    );
    easing.dampC(
      frame.current.material.color,
      hovered ? "orange" : "white",
      0.1,
      dt
    );
  });
  return (
    <group {...props}>
      <mesh
        name={name}
        onPointerOver={(e) => {
          e.stopPropagation();
          hover(true);
        }}
        onPointerOut={() => hover(false)}
        scale={[1, GOLDENRATIO, 0.05]}
        position={[0, GOLDENRATIO / 2, 0]}
      >
        <boxGeometry />
        <meshStandardMaterial
          color="#151515"
          metalness={0.5}
          roughness={0.5}
          envMapIntensity={2}
        />
        <mesh
          ref={frame}
          raycast={() => null}
          scale={[0.9, 0.93, 0.9]}
          position={[0, 0, 0.2]}
        >
          <boxGeometry />
          <meshBasicMaterial toneMapped={false} fog={false} />
        </mesh>
        <Image
          raycast={() => null}
          ref={image}
          position={[0, 0, 0.7]}
          url={url}
        />
      </mesh>
      <Text
        maxWidth={0.8}
        anchorX="left"
        anchorY="top"
        position={[0.55, GOLDENRATIO, 0]}
        fontSize={0.055}
      >
        {name.split("(")[0]}
      </Text>
      <Text
        maxWidth={0.8}
        anchorX="left"
        anchorY="top"
        position={[0.55, GOLDENRATIO - 0.08, 0]}
        fontSize={0.04}
      >
        {name.split("(")[1].slice(0, -1)}
      </Text>
    </group>
  );
}

function Frames({
  images,
  q = new Quaternion(),
  p = new Vector3(),
}: {
  images: ImageItem[];
  q?: Quaternion;
  p?: Vector3;
}) {
  const ref = useRef<any>();
  const clicked = useRef<any>();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    clicked.current = ref.current.getObjectByName(selectedId);
    if (clicked.current) {
      clicked.current.parent.updateWorldMatrix(true, true);
      clicked.current.parent.localToWorld(p.set(0, GOLDENRATIO / 2, 1.25));
      clicked.current.parent.getWorldQuaternion(q);
    } else {
      p.set(0, 0, 5.5);
      q.identity();
    }
  });
  useFrame((state, dt) => {
    easing.damp3(state.camera.position, p, 0.4, dt);
    easing.dampQ(state.camera.quaternion, q, 0.4, dt);
  });
  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedId(e.object.name);
      }}
      onPointerMissed={() => setSelectedId(undefined)}
    >
      {images.map((props) => (
        <Frame key={props.url} selectedId={selectedId || ""} {...props} />
      ))}
    </group>
  );
}

export const GalleryModel = ({ images }: { images: ImageItem[] }) => (
  <Canvas dpr={[1, 1.5]} camera={{ fov: 70, position: [0, 2, 15] }}>
    <color attach="background" args={["#191920"]} />
    <fog attach="fog" args={["#191920", 0, 15]} />
    <group position={[0, -0.5, 0]}>
      <Frames images={images} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={2048}
          mixBlur={1}
          mixStrength={80}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050505"
          metalness={0.5}
          mirror={1}
        />
      </mesh>
    </group>
    <Environment preset="city" />
  </Canvas>
);
