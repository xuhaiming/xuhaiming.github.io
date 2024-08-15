/* eslint-disable react/no-unknown-property, no-nested-ternary */
import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Text, useTexture } from "@react-three/drei";
import { inSphere } from "maath/random";
import { Color, AdditiveBlending, CanvasTexture, Mesh, Points as ThreePoints } from "three";

interface StarsModelProps {
  title: string;
  description: string;
}

function TitleAndDescription({ title, description }: StarsModelProps) {
  const titleRef = useRef<Mesh>(null);
  const descriptionRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (titleRef.current && descriptionRef.current) {
      titleRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      descriptionRef.current.position.y =
        Math.cos(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <Text
        ref={titleRef}
        position={[0, 0.4, 0]}
        fontSize={0.12}
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
      >
        {description}
      </Text>
    </group>
  );
}

function blackbodyToHex(temperature: number): number {
  const x = temperature / 1000;
  let r, g, b;

  if (x <= 66) {
    r = 255;
    g = Math.min(
      Math.max(Math.round(99.4708025861 * Math.log(x) - 161.1195681661), 0),
      255
    );
    b =
      x <= 19
        ? 0
        : Math.min(
            Math.max(
              Math.round(138.5177312231 * Math.log(x - 10) - 305.0447927307),
              0
            ),
            255
          );
  } else {
    r = Math.min(
      Math.max(Math.round(329.698727446 * Math.pow(x - 60, -0.1332047592)), 0),
      255
    );
    g = Math.min(
      Math.max(Math.round(288.1221695283 * Math.pow(x - 60, -0.0755148492)), 0),
      255
    );
    b = 255;
  }

  return (r << 16) | (g << 8) | b;
}

const createStarTexture = useCallback(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  return new CanvasTexture(canvas);
}, []);

function Stars() {
  const ref = useRef<ThreePoints>(null);
  const [sphere] = useState(() => inSphere(new Float32Array(6000), { radius: 1.1 }));
  const [colors, setColors] = useState(() => {
    const array = new Float32Array(sphere.length);
    for (let i = 0; i < sphere.length; i += 3) {
      const color = new Color();
      const temperature = Math.random() * 18000 + 4800;
      color.setHex(blackbodyToHex(temperature));
      color.toArray(array, i);
    }
    return array;
  });

  const starTexture = useTexture(createStarTexture());

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 60;
      ref.current.rotation.y -= delta / 90;
    }

    const newColors = new Float32Array(colors);
    for (let i = 0; i < newColors.length; i += 3) {
      const twinkle = Math.random() * 0.1 + 0.9;
      newColors[i] *= twinkle;
      newColors[i + 1] *= twinkle;
      newColors[i + 2] *= twinkle;
    }
    setColors(newColors);
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
          size={0.008}
          sizeAttenuation={true}
          depthWrite={false}
          blending={AdditiveBlending}
          opacity={0.8}
          map={starTexture}
          alphaTest={0.01}
        />
      </Points>
    </group>
  );
}

export default function StarsModel({ title, description }: StarsModelProps) {
  return (
    <Canvas camera={{ position: [0, 0, 1.5] }}>
      <color attach="background" args={["black"]} />
      <ambientLight intensity={0.1} />
      <Stars />
      <TitleAndDescription title={title} description={description} />
    </Canvas>
  );
}
