/* eslint-disable react/no-unknown-property, no-nested-ternary */
import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Text } from "@react-three/drei";
import { inSphere } from "maath/random";
import { Color, SRGBColorSpace } from "three";

interface StarsModelProps {
  title: string;
  description: string;
}

function TitleAndDescription({ title, description }: StarsModelProps) {
  const titleRef = useRef<any>();
  const descriptionRef = useRef<any>();

  useFrame((state) => {
    if (titleRef.current && descriptionRef.current) {
      titleRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      descriptionRef.current.position.y = Math.cos(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <Text
        ref={titleRef}
        position={[0, 0.4, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      <Text
        ref={descriptionRef}
        position={[0, 0.1, 0]}
        fontSize={0.06}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.5}
        opacity={0.8}
      >
        {description}
      </Text>
    </group>
  );
}

function Stars() {
  const ref = useRef<any>();
  const [sphere] = useState(() =>
    inSphere(new Float32Array(6000), { radius: 1.1 })
  );
  const [colors] = useState(() => {
    const array = new Float32Array(sphere.length);
    for (let i = 0; i < sphere.length; i += 3) {
      const color = new Color();
      const temperature = Math.random() * 18000 + 4800;

      const hue =
        temperature < 5000
          ? 0
          : temperature < 6000
            ? 0.08
            : temperature < 7000
              ? 0.15
              : 0.6;
      const saturation = Math.random() * 0.2 + 0.8;
      const lightness = Math.random() * 0.2 + 0.2;
      color.setHSL(hue, saturation, lightness);
      color.toArray(array, i);
    }
    return array;
  });

  useFrame((_state, delta) => {
    ref.current.rotation.x -= delta / 60;
    ref.current.rotation.y -= delta / 90;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points
        ref={ref}
        positions={new Float32Array(Array.from(sphere))}
        colors={colors}
        stride={3}
        frustumCulled={false}
      >
        <PointMaterial
          transparent
          vertexColors
          size={0.005}
          sizeAttenuation={true}
          depthWrite={false}
          colorSpace={SRGBColorSpace}
        />
      </Points>
    </group>
  );
}

export default function StarsModel({ title, description }: StarsModelProps) {
  return (
    <Canvas camera={{ position: [0, 0, 1.5] }}>
      <color attach="background" args={["black"]} />
      <Stars />
      <TitleAndDescription title={title} description={description} />
    </Canvas>
  );
}
