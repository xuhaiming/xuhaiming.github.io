import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const AvatarPlaceholder = () => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = Math.sin(time * 0.5) * 0.1;
      groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.1;
    }

    // Subtle breathing effect
    if (bodyRef.current) {
      const breathScale = 1 + Math.sin(time * 2) * 0.02;
      bodyRef.current.scale.set(breathScale, 1, breathScale);
    }

    // Gentle head movement
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(time * 0.7) * 0.15;
      headRef.current.rotation.x = Math.sin(time * 0.5) * 0.05;
    }

    // Arm sway
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.z = Math.sin(time * 0.6) * 0.1;
      rightArmRef.current.rotation.z = -Math.sin(time * 0.6) * 0.1;
    }
  });

  const glowMaterial = new THREE.MeshPhysicalMaterial({
    color: "#8B5CF6",
    emissive: "#8B5CF6",
    emissiveIntensity: 0.3,
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.9,
  });

  const accentMaterial = new THREE.MeshPhysicalMaterial({
    color: "#00EEFF",
    emissive: "#00EEFF",
    emissiveIntensity: 0.4,
    metalness: 0.3,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.8,
  });

  return (
    <group ref={groupRef} scale={[0.35, 0.35, 0.35]} position={[0, 0.5, 0]}>
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <primitive object={glowMaterial} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.08, 1.45, 0.2]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <primitive object={accentMaterial} />
      </mesh>
      <mesh position={[0.08, 1.45, 0.2]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <primitive object={accentMaterial} />
      </mesh>

      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 0.8, 32]} />
        <primitive object={glowMaterial} />
      </mesh>

      {/* Arms */}
      <mesh ref={leftArmRef} position={[-0.4, 0.8, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.08, 0.06, 0.6, 16]} />
        <primitive object={glowMaterial} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.4, 0.8, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.08, 0.06, 0.6, 16]} />
        <primitive object={glowMaterial} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.45, 0.4, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <primitive object={accentMaterial} />
      </mesh>
      <mesh position={[0.45, 0.4, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <primitive object={accentMaterial} />
      </mesh>

      {/* Legs */}
      <mesh ref={leftLegRef} position={[-0.15, -0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.8, 16]} />
        <primitive object={glowMaterial} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.15, -0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.8, 16]} />
        <primitive object={glowMaterial} />
      </mesh>

      {/* Feet */}
      <mesh position={[-0.15, -0.6, 0.1]}>
        <boxGeometry args={[0.12, 0.08, 0.25]} />
        <primitive object={accentMaterial} />
      </mesh>
      <mesh position={[0.15, -0.6, 0.1]}>
        <boxGeometry args={[0.12, 0.08, 0.25]} />
        <primitive object={accentMaterial} />
      </mesh>

      {/* Chest accent */}
      <mesh position={[0, 0.7, 0.26]}>
        <circleGeometry args={[0.08, 32]} />
        <primitive object={accentMaterial} />
      </mesh>

      {/* Shoulder accents */}
      <mesh position={[-0.25, 0.9, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <primitive object={accentMaterial} />
      </mesh>
      <mesh position={[0.25, 0.9, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <primitive object={accentMaterial} />
      </mesh>

      {/* Floating particles around the avatar */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 0.8;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              0.5 + Math.sin(i * 0.5) * 0.3,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.02, 8, 8]} />
            <primitive object={accentMaterial} />
          </mesh>
        );
      })}
    </group>
  );
};

export default AvatarPlaceholder;
