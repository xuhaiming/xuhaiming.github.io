/* eslint-disable react/no-unknown-property, no-nested-ternary */
import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { inSphere } from "maath/random";
import { Color, SRGBColorSpace } from "three";

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

export default function StarsModel() {
  return (
    <Canvas camera={{ position: [0, 0, 1] }}>
      <color attach="background" args={["black"]} />
      <Stars />
    </Canvas>
  );
}
