/* eslint-disable react/no-unknown-property, no-nested-ternary */
import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { inSphere } from "maath/random";
import { Color, SRGBColorSpace } from "three";

function Stars() {
  const ref = useRef<any>();
  const [sphere] = useState(() =>
    inSphere(new Float32Array(5400), { radius: 1.5 })
  );
  // Create a buffer for the colors
  const [colors] = useState(() => {
    const array = new Float32Array(sphere.length);
    for (let i = 0; i < sphere.length; i += 3) {
      // Assign a random color to each point based on the temperature
      const color = new Color(); // Use THREE.Color instead of Color
      const temperature = Math.random() * 18000 + 4800; // A random value between 3000 and 25000

      const hue =
        temperature < 5000
          ? 0
          : temperature < 6000
            ? 0.08
            : temperature < 7000
              ? 0.15
              : 0.6; // A value between 0 and 0.6 based on the temperature
      const saturation = Math.random() * 0.2 + 0.8; // A random value between 0.8 and 1
      const lightness = Math.random() * 0.2 + 0.2; // A random value between 0.8 and 1
      color.setHSL(hue, saturation, lightness);
      color.toArray(array, i);
    }
    return array;
  });

  useFrame((state, delta) => {
    ref.current.rotation.x -= delta / 20;
    ref.current.rotation.y -= delta / 30;
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
          vertexColors // Enable vertex colors for the material
          size={0.005}
          sizeAttenuation={true}
          depthWrite={false}
          colorSpace={SRGBColorSpace}
        />
      </Points>
    </group>
  );
}

export default function StarsModel() {
  return (
    <Canvas camera={{ position: [0, 0, 1] }}>
      <color attach="background" args={["black"]} />
      <Stars />
    </Canvas>
  );
}
