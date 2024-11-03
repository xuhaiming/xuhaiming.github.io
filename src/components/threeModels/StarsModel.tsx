/* eslint-disable react/no-unknown-property, no-nested-ternary */
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Text } from "@react-three/drei";
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
      // Temperature range for main sequence stars (in Kelvin)
      const temperature = Math.random() * 48000 + 2000; // From red dwarfs (~2000K) to hottest blue giants (~50000K)

      // Convert temperature to RGB using more realistic stellar classification
      let hue;
      let saturation;
      let lightness;

      if (temperature < 3500) {
        // Class M (Deep Red)
        hue = 0;
        saturation = 0.95;
        lightness = 0.4;
      } else if (temperature < 5000) {
        // Class K (Orange-Red)
        hue = 0.05;
        saturation = 0.9;
        lightness = 0.5;
      } else if (temperature < 6000) {
        // Class G (Yellow)
        hue = 0.15;
        saturation = 0.85;
        lightness = 0.6;
      } else if (temperature < 7500) {
        // Class F (Yellow-White)
        hue = 0.17;
        saturation = 0.7;
        lightness = 0.7;
      } else if (temperature < 10000) {
        // Class A (White with blue tint)
        hue = 0.6;
        saturation = 0.3;
        lightness = 0.8;
      } else if (temperature < 30000) {
        // Class B (Blue-White)
        hue = 0.6;
        saturation = 0.6;
        lightness = 0.75;
      } else {
        // Class O (Bright Blue)
        hue = 0.65;
        saturation = 0.8;
        lightness = 0.7;
      }

      // Add some random variation to make stars more unique
      hue += (Math.random() - 0.5) * 0.05;
      saturation *= 0.9 + Math.random() * 0.2;
      lightness *= 0.9 + Math.random() * 0.2;

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

function TextArea() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, z: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device has orientation support and screen resolution
    const isMobileDevice = window.DeviceOrientationEvent !== undefined;
    const isMobileResolution = window.innerWidth <= 768; // Common mobile breakpoint
    setIsMobile(isMobileDevice && isMobileResolution);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta ? event.beta : 0; // X-axis rotation (-180 to 180)
      const gamma = event.gamma ? event.gamma : 0; // Y-axis rotation (-90 to 90)

      // Convert orientation angles to normalized coordinates
      const x = (gamma / 90) * 100;
      const y = (beta / 180) * 100;
      const z = Math.abs(x * y) * 500;

      setMousePosition({ x, y, z });
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation);
  }, [isMobile]);

  useFrame(({ mouse }) => {
    if (isMobile) return; // Skip mouse tracking on mobile

    // Convert mouse coordinates from [-1, 1] to desired text movement range
    const x = mouse.x * 100; // Adjust multiplier to control movement range
    const y = mouse.y * 100;
    const z = Math.abs(mouse.x * mouse.y) * 500; // Z movement based on x/y position
    setMousePosition({ x, y, z });
  });

  return (
    <group position={[0, 0.2, -999]}>
      <Text
        fontSize={50}
        color="#f5f5f5"
        anchorX="center"
        anchorY="middle"
        position={[mousePosition.x, mousePosition.y, mousePosition.z]}
        fillOpacity={0.9}
        strokeWidth={1}
        strokeColor="#bdbdbd"
      >
        Haiming Pages
      </Text>
      <Text
        fontSize={25}
        color="#f5f5f5"
        anchorX="center"
        anchorY="middle"
        position={[mousePosition.x, mousePosition.y - 80, mousePosition.z]}
        fillOpacity={0.7}
        strokeWidth={0.5}
        strokeColor="#bdbdbd"
      >
        Welcome to my personal website created by Haiming Xu
      </Text>
    </group>
  );
}

export default function StarsModel() {
  return (
    <Canvas camera={{ position: [0, 0, 1] }}>
      <color attach="background" args={["black"]} />
      <Stars />
      <TextArea />
    </Canvas>
  );
}
