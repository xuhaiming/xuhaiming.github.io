import React, { useRef, useState, useEffect, Suspense, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { cn } from "@/lib/utils";
import AvatarPlaceholder from "./AvatarPlaceholder";

interface ThreeSceneProps {
  className?: string;
  sceneType: "hero" | "about" | "skills" | "projects" | "contact";
  selectedProject?: number;
  isVisible?: boolean; // NEW: Control rendering based on visibility
}

const ShootingStar = () => {
  const mesh = useRef<THREE.Mesh>(null);
  const [active, setActive] = useState(false);

  // Reset star position and trajectory
  const reset = () => {
    if (!mesh.current) return;

    const startX = (Math.random() - 0.5) * 40;
    const startY = (Math.random() - 0.5) * 40;
    const startZ = (Math.random() - 0.5) * 20 - 10;

    mesh.current.position.set(startX, startY, startZ);

    const speed = 0.5 + Math.random() * 1.5;
    const angle = Math.random() * Math.PI * 2;
    mesh.current.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      0
    );

    mesh.current.scale.set(0.1, 0.1, 0.1);
    setActive(true);
  };

  useFrame(() => {
    if (!mesh.current) return;

    if (active) {
      mesh.current.position.add(mesh.current.userData.velocity);

      const target = mesh.current.position.clone().add(mesh.current.userData.velocity);
      mesh.current.lookAt(target);

      const speed = mesh.current.userData.velocity.length();
      mesh.current.scale.z = 1 + speed * 3;
      mesh.current.scale.x = 0.1;
      mesh.current.scale.y = 0.1;

      if (
        Math.abs(mesh.current.position.x) > 25 ||
        Math.abs(mesh.current.position.y) > 25
      ) {
        setActive(false);
      }
    } else {
      if (Math.random() < 0.005) {
        reset();
      }
    }
  });

  // Cleanup geometry and material on unmount
  useEffect(() => {
    return () => {
      if (mesh.current?.geometry) {
        mesh.current.geometry.dispose();
      }
      if (mesh.current?.material && 'dispose' in mesh.current.material) {
        (mesh.current.material as THREE.Material).dispose();
      }
    };
  }, []);

  return (
    <mesh ref={mesh} visible={active} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
      <meshBasicMaterial color="#00EEFF" transparent opacity={0.8} />
    </mesh>
  );
};

const StarField = () => {
  const count = 6000;
  const mesh = useRef<THREE.Points>(null);

  // Create a simple circle texture for the stars - MEMOIZED
  const starTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      context.arc(16, 16, 14, 0, Math.PI * 2);
      context.fillStyle = 'white';
      context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      if (starTexture) {
        starTexture.dispose();
      }
    };
  }, [starTexture]);

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 35 - 2.5;
      temp.push(x, y, z);
    }
    return new Float32Array(temp);
  }, [count]);

  const colors = useMemo(() => {
    const temp = [];
    const colorPalette = [
      new THREE.Color("#00EEFF"),
      new THREE.Color("#8B5CF6"),
      new THREE.Color("#F471B5"),
      new THREE.Color("#ffffff"),
    ];

    for (let i = 0; i < count; i++) {
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      temp.push(color.r, color.g, color.b);
    }
    return new Float32Array(temp);
  }, [count]);

  const sizes = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push(Math.random() * 0.15 + 0.05);
    }
    return new Float32Array(temp);
  }, [count]);

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.rotation.y = clock.getElapsedTime() * 0.02;
      mesh.current.rotation.z = clock.getElapsedTime() * 0.005;
    }
  });

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      if (mesh.current?.geometry) {
        mesh.current.geometry.dispose();
      }
      if (mesh.current?.material && 'dispose' in mesh.current.material) {
        (mesh.current.material as THREE.Material).dispose();
      }
    };
  }, []);

  return (
    <>
      <points ref={mesh}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.length / 3}
            array={particles}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={sizes.length}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.2}
          sizeAttenuation={true}
          depthWrite={false}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          map={starTexture}
          alphaTest={0.001}
        />
      </points>
      {/* Shooting Stars */}
      {Array.from({ length: 5 }).map((_, i) => (
        <ShootingStar key={i} />
      ))}
    </>
  );
};

const HeroScene = () => {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);

  const [textureError, setTextureError] = useState(false);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [glowTexture, setGlowTexture] = useState<THREE.Texture | null>(null);
  const [noiseTexture, setNoiseTexture] = useState<THREE.Texture | null>(null);

  // FIXED: Load textures with proper cleanup using local variables
  useEffect(() => {
    let isMounted = true;
    let loadedTexture: THREE.Texture | null = null;
    let loadedGlowTexture: THREE.Texture | null = null;
    let loadedNoiseTexture: THREE.Texture | null = null;

    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
      console.error(`Error loading texture from ${url}`);
      if (isMounted) {
        setTextureError(true);
      }
    };

    const textureLoader = new THREE.TextureLoader(loadingManager);
    const texturePaths = [
      "/assets/globe2.jpeg",
      "./assets/globe2.jpeg",
      "../public/assets/globe2.jpeg",
    ];

    const attemptTextureLoad = (pathIndex = 0) => {
      if (!isMounted || pathIndex >= texturePaths.length) {
        if (pathIndex >= texturePaths.length) {
          console.error("All texture load attempts failed");
          if (isMounted) {
            setTextureError(true);
          }
        }
        return;
      }

      const path = texturePaths[pathIndex];
      console.log(`Attempting to load texture from: ${path}`);

      textureLoader.load(
        path,
        (tex) => {
          if (!isMounted) {
            tex.dispose();
            return;
          }
          console.log(`Texture loaded successfully from: ${path}`);
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.repeat.set(1, 1);
          tex.offset.set(0, 0);
          tex.center.set(0.5, 0.5);
          tex.rotation = 0;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = true;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = 16;
          tex.needsUpdate = true;
          loadedTexture = tex;
          setTexture(tex);
        },
        (progressEvent) => {
          console.log(`Loading texture progress from ${path}:`, progressEvent);
        },
        (error) => {
          console.error(`Error loading texture from ${path}:`, error);
          attemptTextureLoad(pathIndex + 1);
        }
      );
    };

    attemptTextureLoad();

    const glowSize = 128;
    const canvas = document.createElement("canvas");
    canvas.width = glowSize;
    canvas.height = glowSize;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(
        glowSize / 2,
        glowSize / 2,
        0,
        glowSize / 2,
        glowSize / 2,
        glowSize / 2
      );
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, glowSize, glowSize);
      const glowTex = new THREE.CanvasTexture(canvas);
      loadedGlowTexture = glowTex;
      if (isMounted) {
        setGlowTexture(glowTex);
      }
    }

    const noiseSize = 256;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);

    const createNoise2D = () => {
      const permutation = [];
      for (let i = 0; i < 256; i++) {
        permutation[i] = Math.floor(Math.random() * 256);
      }
      const p = [...permutation, ...permutation];

      const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
      const lerp = (t: number, a: number, b: number) => a + t * (b - a);
      const grad = (hash: number, x: number, y: number) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
      };

      return (x: number, y: number) => {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = fade(x);
        const v = fade(y);

        const A = p[X] + Y;
        const B = p[X + 1] + Y;

        return (
          lerp(
            v,
            lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)),
            lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1))
          ) *
          0.5 +
          0.5
        );
      };
    };

    const noise2D = createNoise2D();

    for (let i = 0; i < noiseSize * noiseSize * 4; i += 4) {
      const x = Math.floor(i / 4) % noiseSize;
      const y = Math.floor(i / 4 / noiseSize);

      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;

      for (let o = 0; o < 4; o++) {
        const noiseVal = noise2D(
          (x * frequency) / noiseSize,
          (y * frequency) / noiseSize
        );
        value += noiseVal * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      value = value / maxValue;

      const intensity = Math.floor(value * 255);
      noiseData[i] = intensity;
      noiseData[i + 1] = intensity;
      noiseData[i + 2] = intensity;
      noiseData[i + 3] = 255;
    }

    const noiseTex = new THREE.DataTexture(
      noiseData,
      noiseSize,
      noiseSize,
      THREE.RGBAFormat
    );
    noiseTex.needsUpdate = true;
    loadedNoiseTexture = noiseTex;
    if (isMounted) {
      setNoiseTexture(noiseTex);
    }

    return () => {
      isMounted = false;
      // Cleanup using local variables, not state
      if (loadedTexture) loadedTexture.dispose();
      if (loadedGlowTexture) loadedGlowTexture.dispose();
      if (loadedNoiseTexture) loadedNoiseTexture.dispose();
    };
  }, []);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();

    if (sphereRef.current) {
      sphereRef.current.rotation.y = elapsedTime * 0.05;
      sphereRef.current.rotation.z = Math.sin(elapsedTime * 0.02) * 0.02;
      sphereRef.current.position.y = Math.sin(elapsedTime * 0.3) * 0.02;
    }

    if (ringRef.current) {
      ringRef.current.rotation.x =
        Math.PI / 2 + Math.sin(elapsedTime * 0.3) * 0.05;
      ringRef.current.rotation.y = elapsedTime * 0.2;
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.5 + Math.sin(elapsedTime) * 0.1);

      if (glowRef.current.material instanceof THREE.SpriteMaterial) {
        const hue = (Math.sin(elapsedTime * 0.5) + 1) * 0.5;
        glowRef.current.material.color.setHSL(hue, 1, 0.5);
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} color="#ffffff" />
      <directionalLight position={[-5, 5, 5]} intensity={0.3} color="#ffffff" />
      <hemisphereLight args={["#ffffff", "#000000", 0.3]} />
      <color attach="background" args={["#000000"]} />

      <group>
        <StarField />

        <mesh ref={sphereRef}>
          <sphereGeometry args={[1, 128, 128]} />
          {texture ? (
            <meshStandardMaterial
              map={texture}
              color="#ffffff"
              metalness={0}
              roughness={1}
              normalScale={new THREE.Vector2(1, 1)}
              envMapIntensity={1}
              toneMapped={false}
            />
          ) : (
            <meshPhysicalMaterial
              color={textureError ? "#9b87f5" : "#ffffff"}
              displacementMap={noiseTexture || undefined}
              displacementScale={0.05}
              metalness={0.5}
              roughness={0.2}
              clearcoat={1}
              clearcoatRoughness={0.1}
              envMapIntensity={1}
              emissive="#8B5CF6"
              emissiveIntensity={0.2}
            />
          )}
        </mesh>

        {glowTexture && (
          <sprite ref={glowRef} scale={[3, 3, 3]}>
            <spriteMaterial
              map={glowTexture}
              transparent
              opacity={0.5}
              color="#9b87f5"
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        )}
      </group>

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>

      <fog attach="fog" args={["#070726", 5, 40]} />
    </>
  );
};

const AboutScene = () => {
  const modelRef = useRef<THREE.Group>(null);

  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);

  useFrame(({ clock }) => {
    if (modelRef.current) {
      modelRef.current.rotation.y = clock.getElapsedTime() * 0.6;
      const baseY = isAvatarLoaded ? -2 : -0.5;
      modelRef.current.position.y = baseY + Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 5]} intensity={0.3} color="#ffffff" />
      <directionalLight position={[-5, 5, 5]} intensity={0.3} color="#ffffff" />
      <directionalLight position={[0, 5, -5]} intensity={0} color="#ffffff" />
      <pointLight position={[0, 2, 2]} intensity={0.7} color="#ffffff" />
      <pointLight position={[2, 0, 2]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-2, 0, 2]} intensity={0.9} color="#ffffff" />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />

      <group
        ref={modelRef}
        scale={[3.6, 3.6, 3.6]}
        position={[0, 0, 0]}
      >
        <Suspense fallback={<AvatarPlaceholder />}>
          <AvatarModel onLoaded={() => setIsAvatarLoaded(true)} />
        </Suspense>
      </group>

      <fog attach="fog" args={["#070726", 5, 15]} />
    </>
  );
};

const AvatarModel = ({ onLoaded }: { onLoaded?: () => void }) => {
  const [hasError, setHasError] = useState(false);
  const hasModifiedMaterials = useRef(false);

  const gltf = useGLTF("/assets/avatar2.glb");

  useEffect(() => {
    if (!gltf.scene) {
      setHasError(true);
    } else {
      onLoaded?.();

      // Only modify materials once
      if (!hasModifiedMaterials.current) {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((material) => {
                  if (
                    material instanceof THREE.MeshStandardMaterial ||
                    material instanceof THREE.MeshPhysicalMaterial
                  ) {
                    material.color.multiplyScalar(0.9);
                    material.emissiveIntensity = 0;
                    material.metalness = 0.1;
                    material.roughness = 0.8;
                    material.needsUpdate = true;
                  }
                });
              } else {
                const material = child.material;
                if (
                  material instanceof THREE.MeshStandardMaterial ||
                  material instanceof THREE.MeshPhysicalMaterial
                ) {
                  material.color.multiplyScalar(0.9);
                  material.emissiveIntensity = 0;
                  material.metalness = 0.1;
                  material.roughness = 0.8;
                  material.needsUpdate = true;
                }
              }
            }
          }
        });
        hasModifiedMaterials.current = true;
      }
    }

    // Cleanup on unmount
    return () => {
      if (gltf.scene) {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((material) => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    };
  }, [gltf.scene, onLoaded]);

  if (hasError) {
    return (
      <mesh>
        <torusKnotGeometry args={[1, 0.3, 128, 32]} />
        <meshStandardMaterial
          color="#8B5CF6"
          metalness={0.7}
          roughness={0.2}
          emissive="#8B5CF6"
          emissiveIntensity={0.3}
        />
      </mesh>
    );
  }

  return <primitive object={gltf.scene} />;
};

useGLTF.preload("/assets/avatar2.glb");

const SkillsScene = () => {
  const cubesRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (cubesRef.current) {
      cubesRef.current.children.forEach((cube, i) => {
        cube.rotation.x = Math.sin(clock.getElapsedTime() * 0.5 + i) * 0.5;
        cube.rotation.y = Math.cos(clock.getElapsedTime() * 0.5 + i) * 0.5;
      });
    }
  });

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      if (cubesRef.current) {
        cubesRef.current.children.forEach((cube) => {
          if (cube instanceof THREE.Mesh) {
            if (cube.geometry) {
              cube.geometry.dispose();
            }
            if (cube.material) {
              if (Array.isArray(cube.material)) {
                cube.material.forEach((material) => material.dispose());
              } else {
                cube.material.dispose();
              }
            }
          }
        });
      }
    };
  }, []);

  return (
    <>
      <ambientLight intensity={0.3} />
      <spotLight position={[5, 5, 5]} intensity={1} />

      <group ref={cubesRef}>
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <mesh key={i} position={[x, y, 0]}>
              <boxGeometry args={[0.8, 0.8, 0.8]} />
              <meshStandardMaterial
                color={`hsl(${i * 60}, 100%, 75%)`}
                emissive={`hsl(${i * 60}, 100%, 50%)`}
                emissiveIntensity={0.5}
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>
          );
        })}
      </group>
    </>
  );
};

const ProjectsScene = ({
  selectedProject = 0,
}: {
  selectedProject?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const [targetRotations, setTargetRotations] = useState<THREE.Euler[]>([]);
  const [currentRotations, setCurrentRotations] = useState<THREE.Euler[]>([]);
  const [targetPositions, setTargetPositions] = useState<THREE.Vector3[]>([]);
  const [currentPositions, setCurrentPositions] = useState<THREE.Vector3[]>([]);
  const [targetScales, setTargetScales] = useState<THREE.Vector3[]>([]);
  const [currentScales, setCurrentScales] = useState<THREE.Vector3[]>([]);

  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  const { gl } = useThree();

  const [glowTexture, setGlowTexture] = useState<THREE.Texture | null>(null);

  // FIXED: Environment map creation with proper cleanup using local variables
  useEffect(() => {
    let isMounted = true;
    let glowTex: THREE.Texture | null = null;
    let envTex: THREE.Texture | null = null;
    let renderTarget: THREE.WebGLRenderTarget | null = null;
    let pmremGen: THREE.PMREMGenerator | null = null;
    
    const glowSize = 256;
    const canvas = document.createElement("canvas");
    canvas.width = glowSize;
    canvas.height = glowSize;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(
        glowSize / 2,
        glowSize / 2,
        0,
        glowSize / 2,
        glowSize / 2,
        glowSize / 2
      );
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.3, "rgba(139,92,246,0.8)");
      gradient.addColorStop(0.6, "rgba(0,238,255,0.4)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, glowSize, glowSize);
      glowTex = new THREE.CanvasTexture(canvas);
      if (isMounted) {
        setGlowTexture(glowTex);
      }
    }

    pmremGen = new THREE.PMREMGenerator(gl);
    pmremGen.compileEquirectangularShader();

    renderTarget = pmremGen.fromScene(new THREE.Scene(), 0.04);
    envTex = renderTarget.texture;

    if (isMounted) {
      setEnvMap(envTex);
    }

    return () => {
      isMounted = false;
      // Cleanup using local variables, not state
      if (glowTex) glowTex.dispose();
      if (envTex) envTex.dispose();
      if (renderTarget) renderTarget.dispose();
      if (pmremGen) pmremGen.dispose();
    };
  }, [gl]);

  // FIXED: Texture loading with proper cleanup
  useEffect(() => {
    let isMounted = true;
    const loader = new THREE.TextureLoader();
    const projectImages = [
      "/assets/project1.png",
      "/assets/project2.png",
      "/assets/project3.png",
    ];

    const loadedTextures: THREE.Texture[] = [];
    let loadedCount = 0;

    for (let i = 0; i < projectImages.length; i++) loadedTextures.push(undefined as unknown as THREE.Texture);

    projectImages.forEach((url, index) => {
      loader.load(
        url,
        (texture) => {
          if (!isMounted) {
            texture.dispose();
            return;
          }
          
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 16;
          texture.colorSpace = THREE.SRGBColorSpace;

          loadedTextures[index] = texture;
          loadedCount++;

          if (loadedCount === projectImages.length && isMounted) {
            setTextures(loadedTextures);
            setLoading(false);
            setTimeout(() => {
              if (isMounted) {
                setReady(true);
              }
            }, 100);
          }
        },
        undefined,
        (error) => {
          console.error("Error loading project texture:", error);
          loadedCount++;
          if (loadedCount === projectImages.length && isMounted) {
            setLoading(false);
            setReady(true);
          }
        }
      );
    });

    return () => {
      isMounted = false;
      loadedTextures.forEach((texture) => texture?.dispose());
    };
  }, []);

  const aspectRatio = 16 / 9;
  const mainCardWidth = 3.2;
  const mainCardHeight = mainCardWidth / aspectRatio;
  const secondaryCardWidth = mainCardWidth * 0.65;
  const secondaryCardHeight = secondaryCardWidth / aspectRatio;

  useEffect(() => {
    const positions: THREE.Vector3[] = [
      new THREE.Vector3(0, -mainCardHeight * 1.2, -1.2),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, mainCardHeight * 1.2, -1.2),
    ];

    const rotations: THREE.Euler[] = [
      new THREE.Euler(-0.5, 0, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Euler(0.5, 0, 0),
    ];

    const scales: THREE.Vector3[] = [
      new THREE.Vector3(secondaryCardWidth, secondaryCardHeight, 0.05),
      new THREE.Vector3(mainCardWidth, mainCardHeight, 0.05),
      new THREE.Vector3(secondaryCardWidth, secondaryCardHeight, 0.05),
    ];

    setTargetPositions(positions);
    setCurrentPositions(positions.map((p) => p.clone()));
    setTargetRotations(rotations);
    setCurrentRotations(rotations.map((r) => r.clone()));
    setTargetScales(scales);
    setCurrentScales(scales.map((s) => s.clone()));
  }, [mainCardHeight, mainCardWidth, secondaryCardHeight, secondaryCardWidth]);

  useEffect(() => {
    if (targetPositions.length === 0 || targetScales.length === 0) return;

    const newPositions: THREE.Vector3[] = [];
    const newRotations: THREE.Euler[] = [];
    const newScales: THREE.Vector3[] = [];

    for (let i = 0; i < 3; i++) {
      let relativePos;

      if (i === selectedProject) {
        relativePos = 0;
      } else if (
        (i === 0 && selectedProject === 2) ||
        (i === 1 && selectedProject === 0) ||
        (i === 2 && selectedProject === 1)
      ) {
        relativePos = 2;
      } else {
        relativePos = 1;
      }

      switch (relativePos) {
        case 0:
          newPositions[i] = new THREE.Vector3(0, 0, 0);
          newRotations[i] = new THREE.Euler(0, 0, 0);
          newScales[i] = new THREE.Vector3(mainCardWidth, mainCardHeight, 0.05);
          break;
        case 1:
          newPositions[i] = new THREE.Vector3(0, -mainCardHeight * 1.2, -1.2);
          newRotations[i] = new THREE.Euler(-0.5, 0, 0);
          newScales[i] = new THREE.Vector3(
            secondaryCardWidth,
            secondaryCardHeight,
            0.05
          );
          break;
        case 2:
          newPositions[i] = new THREE.Vector3(0, mainCardHeight * 1.2, -1.2);
          newRotations[i] = new THREE.Euler(0.5, 0, 0);
          newScales[i] = new THREE.Vector3(
            secondaryCardWidth,
            secondaryCardHeight,
            0.05
          );
          break;
      }
    }

    setTargetPositions(newPositions);
    setTargetRotations(newRotations);
    setTargetScales(newScales);
  }, [
    selectedProject,
    mainCardHeight,
    mainCardWidth,
    secondaryCardHeight,
    secondaryCardWidth,
  ]);

  const opacityRef = useRef(0);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();

    if (ready) {
      opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, 1, 0.05);
    }

    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(elapsedTime * 0.5) * 0.1;
      groupRef.current.rotation.z = Math.sin(elapsedTime * 0.2) * 0.03;

      if (targetPositions.length === 3 && currentPositions.length === 3) {
        for (let i = 0; i < 3; i++) {
          const isSelected = i === selectedProject;
          const lerpFactor = isSelected ? 0.08 : 0.06;

          if (currentPositions[i] && targetPositions[i]) {
            currentPositions[i].lerp(targetPositions[i], lerpFactor);

            const floatOffset = isSelected
              ? Math.sin(elapsedTime * 0.8 + i) * 0.03
              : Math.sin(elapsedTime * 0.5 + i) * 0.015;

            if (groupRef.current.children[i]) {
              groupRef.current.children[i].position.copy(currentPositions[i]);
              groupRef.current.children[i].position.y += floatOffset;
            }
          }

          if (currentRotations[i] && targetRotations[i]) {
            currentRotations[i].x +=
              (targetRotations[i].x - currentRotations[i].x) * lerpFactor;
            currentRotations[i].y +=
              (targetRotations[i].y - currentRotations[i].y) * lerpFactor;
            currentRotations[i].z +=
              (targetRotations[i].z - currentRotations[i].z) * lerpFactor;

            let wobbleX = 0,
              wobbleY = 0,
              wobbleZ = 0;

            if (isSelected) {
              wobbleX = Math.sin(elapsedTime * 0.6) * 0.02;
              wobbleY = Math.sin(elapsedTime * 0.5) * 0.02;
              wobbleZ = Math.cos(elapsedTime * 0.7) * 0.01;
            }

            if (groupRef.current.children[i]) {
              groupRef.current.children[i].rotation.set(
                currentRotations[i].x + wobbleX,
                currentRotations[i].y + wobbleY,
                currentRotations[i].z + wobbleZ
              );
            }
          }

          if (currentScales[i] && targetScales[i]) {
            currentScales[i].lerp(targetScales[i], lerpFactor);

            const pulse = isSelected ? 1 + Math.sin(elapsedTime * 2) * 0.02 : 1;

            if (groupRef.current.children[i]) {
              groupRef.current.children[i].scale.set(
                currentScales[i].x * pulse,
                currentScales[i].y * pulse,
                currentScales[i].z
              );
            }
          }
        }
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight
        position={[-5, -5, -5]}
        intensity={0.6}
        color="#ffffff"
      />
      <pointLight position={[0, 0, 3]} intensity={0.3} color="#ffffff" />

      <group ref={groupRef}>
        {[0, 1, 2].map((i) => (
          <group
            key={i}
            position={currentPositions[i] || [0, 0, 0]}
            rotation={currentRotations[i] || [0, 0, 0]}
            scale={currentScales[i] || [1, 1, 1]}
          >
            <mesh>
              <planeGeometry args={[1, 1, 5, 5]} />
              {loading || !textures[i] ? (
                <meshStandardMaterial
                  color="#1a1a2e"
                  emissive="#8B5CF6"
                  emissiveIntensity={0.2}
                  transparent
                  opacity={0.8}
                  side={THREE.DoubleSide}
                >
                  {envMap && <primitive attach="envMap" object={envMap} />}
                </meshStandardMaterial>
              ) : (
                <meshBasicMaterial
                  map={textures[i]}
                  transparent
                  opacity={ready ? 1 : 0}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                />
              )}
            </mesh>

            {i === selectedProject && (
              <>
                <mesh position={[0, 0, -0.01]} scale={[1.05, 1.05, 1]}>
                  <planeGeometry args={[1, 1]} />
                  <meshBasicMaterial
                    color={
                      i === 0 ? "#00EEFF" : i === 1 ? "#8B5CF6" : "#F471B5"
                    }
                    transparent
                    opacity={0.2}
                    side={THREE.BackSide}
                  />
                </mesh>
              </>
            )}
          </group>
        ))}
      </group>

      <fog attach="fog" args={["#070726", 10, 25]} />
    </>
  );
};

const ContactScene = () => {
  const boxRef = useRef<THREE.Group>(null);
  const innerCubeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Sprite>(null);

  const particleCount = 200;
  const [particles, setParticles] = useState<{
    positions: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
  } | null>(null);

  const [cubeTextures, setCubeTextures] = useState<THREE.Texture[]>([]);
  const [isLoadingTextures, setIsLoadingTextures] = useState(true);
  const [texturesError, setTexturesError] = useState(false);
  const [glowTexture, setGlowTexture] = useState<THREE.Texture | null>(null);

  // FIXED: Texture loading with proper cleanup using local variables
  useEffect(() => {
    let isMounted = true;
    let glowTex: THREE.Texture | null = null;
    
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
      console.error(`Error loading texture from ${url}`);
      if (isMounted) {
        setTexturesError(true);
      }
    };

    const textureLoader = new THREE.TextureLoader(loadingManager);
    const textureSources = [
      "/assets/haiming_linkedin.png",
      "/assets/haiming_linkedin.png",
      "/assets/haiming_linkedin.png",
      "/assets/haiming_linkedin.png",
      "/assets/haiming_linkedin.png",
      "/assets/haiming_linkedin.png",
    ];

    const glowSize = 128;
    const canvas = document.createElement("canvas");
    canvas.width = glowSize;
    canvas.height = glowSize;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(
        glowSize / 2,
        glowSize / 2,
        0,
        glowSize / 2,
        glowSize / 2,
        glowSize / 2
      );
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, glowSize, glowSize);
      glowTex = new THREE.CanvasTexture(canvas);
      if (isMounted) {
        setGlowTexture(glowTex);
      }
    }

    const loadedTextures: THREE.Texture[] = [];
    let loadedCount = 0;

    textureSources.forEach((src, index) => {
      textureLoader.load(
        src,
        (texture) => {
          if (!isMounted) {
            texture.dispose();
            return;
          }
          
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 16;
          texture.needsUpdate = true;

          loadedTextures[index] = texture;

          loadedCount++;
          if (loadedCount === textureSources.length && isMounted) {
            setCubeTextures(loadedTextures);
            setIsLoadingTextures(false);
          }
        },
        undefined,
        (error) => {
          console.error(`Error loading texture ${index}:`, error);
          if (isMounted) {
            setTexturesError(true);
          }
        }
      );
    });

    return () => {
      isMounted = false;
      loadedTextures.forEach((texture) => texture?.dispose());
      // Cleanup using local variable, not state
      if (glowTex) glowTex.dispose();
    };
  }, []);

  useEffect(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorPalette = [
      new THREE.Color("#00EEFF").multiplyScalar(1.5),
      new THREE.Color("#8B5CF6").multiplyScalar(1.5),
      new THREE.Color("#F471B5").multiplyScalar(1.5),
      new THREE.Color("#9b87f5").multiplyScalar(1.5),
      new THREE.Color("#FFFFFF").multiplyScalar(1.0),
    ];

    for (let i = 0; i < particleCount; i++) {
      const radius = Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 2;

      if (i < particleCount * 0.7) {
        positions[i * 3] = (Math.random() - 0.5) * 3;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 3;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      } else {
        positions[i * 3] = Math.sin(theta) * Math.cos(phi) * radius;
        positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * radius;
        positions[i * 3 + 2] = Math.cos(theta) * radius;
      }

      sizes[i] = Math.random() * 0.15 + 0.05;

      const colorIndex = Math.floor(Math.random() * colorPalette.length);
      const color = colorPalette[colorIndex];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    setParticles({ positions, colors, sizes });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (boxRef.current) {
      boxRef.current.rotation.y = t * 0.2;
      boxRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
      boxRef.current.rotation.z = Math.cos(t * 0.2) * 0.05;
      boxRef.current.position.y = Math.sin(t * 0.7) * 0.1;
    }

    if (innerCubeRef.current) {
      innerCubeRef.current.rotation.y = -t * 0.15 + Math.sin(t * 0.4) * 0.1;
      innerCubeRef.current.rotation.x = Math.cos(t * 0.5) * 0.2;
      innerCubeRef.current.rotation.z = Math.sin(t * 0.3) * 0.1;

      const baseScale = 0.8;
      const pulseIntensity = 0.08;
      const pulseSpeed = 1.2;
      const scale = baseScale + Math.sin(t * pulseSpeed) * pulseIntensity;
      innerCubeRef.current.scale.set(scale, scale, scale);

      if (innerCubeRef.current.material instanceof THREE.MeshPhysicalMaterial) {
        innerCubeRef.current.material.emissiveIntensity =
          0.2 + Math.sin(t * 0.5) * 0.1;
        innerCubeRef.current.material.roughness =
          0.1 + Math.abs(Math.sin(t * 0.2)) * 0.2;
      }
    }

    if (particlesRef.current && particles) {
      particlesRef.current.rotation.y = t * 0.03;

      const positions = particlesRef.current.geometry.attributes.position
        .array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const phaseOffset = i * 0.01;

        positions[i3] += Math.sin(t * 0.5 + phaseOffset) * 0.003;
        positions[i3 + 1] += Math.cos(t * 0.6 + phaseOffset) * 0.003;
        positions[i3 + 2] += Math.sin(t * 0.4 + phaseOffset) * 0.003;

        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        const distance = Math.sqrt(x * x + y * y + z * z);

        const pulseIntensity = 0.001;
        const radiusFactor = Math.sin(t + distance * 2) * pulseIntensity;

        positions[i3] += x * radiusFactor;
        positions[i3 + 1] += y * radiusFactor;
        positions[i3 + 2] += z * radiusFactor;
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;

      if (particlesRef.current.material instanceof THREE.PointsMaterial) {
        particlesRef.current.material.size = 0.2 + Math.sin(t * 0.5) * 0.05;
      }
    }

    if (glowRef.current) {
      const glowScale = 5 + Math.sin(t * 0.7) * 0.5;
      glowRef.current.scale.set(glowScale, glowScale, 1);

      if (glowRef.current.material instanceof THREE.SpriteMaterial) {
        const r = 0.5 + 0.5 * Math.sin(t * 0.3);
        const g = 0.5 + 0.5 * Math.sin(t * 0.4 + 2);
        const b = 0.5 + 0.5 * Math.sin(t * 0.5 + 4);
        glowRef.current.material.color.setRGB(r, g, b);
      }
    }
  });

  // FIXED: Memoize materials to prevent recreation on every render
  const cubeMaterialsRef = useRef<THREE.Material[]>([]);
  
  const cubeMaterials = useMemo(() => {
    // Dispose old materials before creating new ones
    if (cubeMaterialsRef.current.length > 0) {
      cubeMaterialsRef.current.forEach((material) => material.dispose());
      cubeMaterialsRef.current = [];
    }

    let newMaterials: THREE.Material[];
    
    if (isLoadingTextures || texturesError) {
      newMaterials = [
        new THREE.MeshStandardMaterial({
          color: "#8B5CF6",
          emissive: "#8B5CF6",
          emissiveIntensity: 0.2,
        }),
        new THREE.MeshStandardMaterial({
          color: "#00EEFF",
          emissive: "#00EEFF",
          emissiveIntensity: 0.2,
        }),
        new THREE.MeshStandardMaterial({
          color: "#F471B5",
          emissive: "#F471B5",
          emissiveIntensity: 0.2,
        }),
        new THREE.MeshStandardMaterial({
          color: "#9b87f5",
          emissive: "#9b87f5",
          emissiveIntensity: 0.2,
        }),
        new THREE.MeshStandardMaterial({
          color: "#00EEFF",
          emissive: "#00EEFF",
          emissiveIntensity: 0.2,
        }),
        new THREE.MeshStandardMaterial({
          color: "#F471B5",
          emissive: "#F471B5",
          emissiveIntensity: 0.2,
        }),
      ];
    } else {
      newMaterials = cubeTextures.map((texture) => {
        return new THREE.MeshBasicMaterial({
          map: texture,
          color: 0xffffff,
          toneMapped: false,
        });
      });
    }

    cubeMaterialsRef.current = newMaterials;
    return newMaterials;
  }, [isLoadingTextures, texturesError, cubeTextures]);

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      cubeMaterialsRef.current.forEach((material) => material.dispose());
      cubeMaterialsRef.current = [];
    };
  }, []);

  // Cleanup particles geometry on unmount
  useEffect(() => {
    return () => {
      if (particlesRef.current?.geometry) {
        particlesRef.current.geometry.dispose();
      }
      if (particlesRef.current?.material && 'dispose' in particlesRef.current.material) {
        (particlesRef.current.material as THREE.Material).dispose();
      }
    };
  }, []);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#8B5CF6" />
      <pointLight position={[-5, -5, -5]} intensity={1} color="#00eeff" />
      <pointLight position={[0, 0, 5]} intensity={0.8} color="#F471B5" />
      <spotLight
        position={[3, 3, 3]}
        angle={0.3}
        penumbra={0.8}
        intensity={1}
        color="#ffffff"
        castShadow
      />
      {glowTexture && (
        <sprite ref={glowRef} scale={[5, 5, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent={true}
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            color="#8B5CF6"
          />
        </sprite>
      )}
      <group ref={boxRef}>
        <mesh position={[0, 0.3, 0]} scale={[1.98, 1.98, 1.98]}>
          <boxGeometry args={[1, 1, 1]} />
          {cubeMaterials.map((material, index) => (
            <primitive
              key={index}
              object={material}
              attach={`material-${index}`}
            />
          ))}
        </mesh>
        {particles && glowTexture && (
          <points ref={particlesRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={particles.positions.length / 3}
                array={particles.positions}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-color"
                count={particles.colors.length / 3}
                array={particles.colors}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-size"
                count={particles.sizes.length}
                array={particles.sizes}
                itemSize={1}
              />
            </bufferGeometry>
            <pointsMaterial
              size={0.2}
              sizeAttenuation={true}
              vertexColors
              transparent
              opacity={0.8}
              blending={THREE.AdditiveBlending}
              map={glowTexture}
              alphaTest={0.001}
              depthWrite={false}
            />
          </points>
        )}
      </group>
      <fog attach="fog" args={["#070726", 8, 25]} />
    </>
  );
};

// NEW: Add cleanup component for Canvas
const CanvasCleanup = () => {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    return () => {
      // Dispose of all geometries, materials, and textures in the scene
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          // Dispose geometry and buffer attributes
          if (object.geometry) {
            const geometry = object.geometry;
            if (geometry.attributes) {
              Object.keys(geometry.attributes).forEach((key) => {
                const attribute = geometry.attributes[key];
                if (attribute && attribute.array) {
                  delete geometry.attributes[key];
                }
              });
            }
            geometry.dispose();
          }
          
          // Dispose materials and their textures
          if (object.material) {
            const disposeMaterial = (mat: THREE.Material) => {
              // Check and dispose textures
              if ('map' in mat && mat.map) (mat.map as THREE.Texture).dispose();
              if ('normalMap' in mat && mat.normalMap) (mat.normalMap as THREE.Texture).dispose();
              if ('roughnessMap' in mat && mat.roughnessMap) (mat.roughnessMap as THREE.Texture).dispose();
              if ('metalnessMap' in mat && mat.metalnessMap) (mat.metalnessMap as THREE.Texture).dispose();
              if ('emissiveMap' in mat && mat.emissiveMap) (mat.emissiveMap as THREE.Texture).dispose();
              if ('displacementMap' in mat && mat.displacementMap) (mat.displacementMap as THREE.Texture).dispose();
              mat.dispose();
            };
            
            if (Array.isArray(object.material)) {
              object.material.forEach(disposeMaterial);
            } else {
              disposeMaterial(object.material);
            }
          }
        }
        
        // Dispose Points geometry and material
        if (object instanceof THREE.Points) {
          if (object.geometry) {
            const geometry = object.geometry;
            if (geometry.attributes) {
              Object.keys(geometry.attributes).forEach((key) => {
                delete geometry.attributes[key];
              });
            }
            geometry.dispose();
          }
          if (object.material && 'dispose' in object.material) {
            const material = object.material as THREE.PointsMaterial;
            if (material.map) material.map.dispose();
            material.dispose();
          }
        }
        
        // Dispose Sprite material
        if (object instanceof THREE.Sprite) {
          if (object.material) {
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
          }
        }
      });
      
      // Clear the scene
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
      
      // Dispose renderer resources
      gl.dispose();
      
      // Force clear render lists
      if (gl.renderLists) {
        gl.renderLists.dispose();
      }
      
      // Clear any cached programs
      if (gl.info && gl.info.programs) {
        gl.info.programs.length = 0;
      }
    };
  }, [gl, scene]);
  
  return null;
};

const SceneSelector = ({
  sceneType,
  selectedProject,
}: {
  sceneType: ThreeSceneProps["sceneType"];
  selectedProject?: number;
}) => {
  switch (sceneType) {
    case "hero":
      return <HeroScene />;
    case "about":
      return <AboutScene />;
    case "skills":
      return <SkillsScene />;
    case "projects":
      return <ProjectsScene selectedProject={selectedProject} />;
    case "contact":
      return <ContactScene />;
    default:
      return <HeroScene />;
  }
};

const ThreeScene = ({
  className,
  sceneType,
  selectedProject,
  isVisible = true, // NEW: Default to visible for backward compatibility
}: ThreeSceneProps) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // NEW: Clean up on visibility change
  useEffect(() => {
    if (!isVisible && canvasContainerRef.current) {
      // Force garbage collection by clearing the container
      while (canvasContainerRef.current.firstChild) {
        canvasContainerRef.current.removeChild(canvasContainerRef.current.firstChild);
      }
    }
  }, [isVisible]);
  
  // NEW: Don't render Canvas if not visible
  if (!isVisible) {
    return (
      <div ref={canvasContainerRef} className={cn("w-full h-full bg-space-dark", className)} />
    );
  }

  return (
    <div ref={canvasContainerRef} className={cn("w-full h-full", className)}>
      <Canvas
        key={`canvas-${sceneType}`}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <CanvasCleanup />
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <SceneSelector
          sceneType={sceneType}
          selectedProject={selectedProject}
        />
        {sceneType !== "projects" && sceneType !== "about" && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={true}
            autoRotateSpeed={0.5}
            rotateSpeed={0.5}
          />
        )}
      </Canvas>
    </div>
  );
};

export default ThreeScene;
