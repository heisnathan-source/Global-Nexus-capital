"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function Cmc3DAvatar({
  modelPath = "/avatars/cmc-avatar-1.glb",
  size,
  large = false,
  onClick,
}) {
  const mountRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mixerRef = useRef(null);
  const waveRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const container = mountRef.current;

    if (!container) return;

    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = null;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || (large ? 430 : 360);

    const camera = new THREE.PerspectiveCamera(
      30,
      width / Math.max(height, 1),
      0.1,
      100
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(width, height, false);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    if (onClick) {
      renderer.domElement.style.cursor = "pointer";
      renderer.domElement.addEventListener("click", onClick);
    }

    container.appendChild(renderer.domElement);

    /*
     * LIGHTING
     */

    const hemisphere = new THREE.HemisphereLight(
      0xffffff,
      0x667085,
      2.4
    );

    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(
      0xffffff,
      3.5
    );

    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(
      0xcfe0ff,
      2
    );

    fillLight.position.set(-4, 3, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(
      0xffffff,
      2.2
    );

    rimLight.position.set(0, 4, -5);
    scene.add(rimLight);

    /*
     * GROUND SHADOW
     */

    const shadowGeometry = new THREE.CircleGeometry(
      1.05,
      64
    );

    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    });

    const shadow = new THREE.Mesh(
      shadowGeometry,
      shadowMaterial
    );

    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    shadow.scale.set(1.15, 0.5, 1);

    scene.add(shadow);

    /*
     * LOAD SELECTED GLB
     */

    const loader = new GLTFLoader();

    loader.load(
      modelPath,

      (gltf) => {
        if (disposed) return;

        const model = gltf.scene;

        model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;

            if (object.material) {
              object.material.needsUpdate = true;
            }
          }
        });

        /*
         * NORMALIZE MODEL
         */

        const initialBox =
          new THREE.Box3().setFromObject(model);

        const initialSize =
          initialBox.getSize(new THREE.Vector3());

        const initialHeight =
          initialSize.y || 1.8;

        const targetHeight = large
          ? 2.05
          : 1.65;

        const scale =
          targetHeight / initialHeight;

        model.scale.setScalar(scale);

        /*
         * RECALCULATE BOUNDS
         */

        const scaledBox =
          new THREE.Box3().setFromObject(model);

        const scaledCenter =
          scaledBox.getCenter(new THREE.Vector3());

        /*
         * CENTER MODEL
         */

        model.position.x -= scaledCenter.x;
        model.position.z -= scaledCenter.z;

        /*
         * PUT FEET ON GROUND
         */

        model.position.y -= scaledBox.min.y;

        scene.add(model);

        /*
         * CAMERA
         */

        const cameraDistance = large
          ? 4.8
          : 4.35;

        const cameraHeight = large
          ? 1.05
          : 0.95;

        const lookHeight = large
          ? 0.95
          : 0.82;

        camera.position.set(
          0,
          cameraHeight,
          cameraDistance
        );

        camera.lookAt(
          new THREE.Vector3(
            0,
            lookHeight,
            0
          )
        );

        /*
         * GLB ANIMATION
         *
         * Avatar 1 contains an animation.
         * Avatar 2 does not, which is completely fine.
         */

        if (
          gltf.animations &&
          gltf.animations.length > 0
        ) {
          const mixer =
            new THREE.AnimationMixer(model);

          mixerRef.current = mixer;

          const idleClip =
            gltf.animations.find((clip) =>
              /idle|stand|breath/i.test(
                clip.name
              )
            ) ||
            gltf.animations[0];

          if (idleClip) {
            const action =
              mixer.clipAction(idleClip);

            action.play();
          }
        }

        /*
         * WAVE ONLY WHERE ARM BONES EXIST
         */

        const bones = [];

        model.traverse((object) => {
          if (object.isBone) {
            bones.push(object);
          }
        });

        const rightUpperArm =
          bones.find((bone) =>
            /right.*upper.*arm|upper.*arm.*right/i.test(
              bone.name
            )
          ) ||
          bones.find((bone) =>
            /mixamorig.*rightarm|rightarm/i.test(
              bone.name
            )
          ) ||
          bones.find((bone) =>
            /rightarm/i.test(
              bone.name
            )
          );

        const rightForearm =
          bones.find((bone) =>
            /right.*forearm|forearm.*right|lower.*arm.*right/i.test(
              bone.name
            )
          ) ||
          bones.find((bone) =>
            /rightforearm|right.*lowerarm/i.test(
              bone.name
            )
          );

        const rightHand =
          bones.find((bone) =>
            /right.*hand|hand.*right/i.test(
              bone.name
            )
          );

        /*
         * Only enable the special automatic wave
         * when the required arm bones are available.
         */

        if (
          rightUpperArm ||
          rightForearm ||
          rightHand
        ) {
          waveRef.current = {
            rightUpperArm,
            rightForearm,
            rightHand,

            active: false,
            startTime: 0,

            duration: 4.5,
            nextWave: 30,

            original: {
              upperArm:
                rightUpperArm
                  ? rightUpperArm.rotation.clone()
                  : null,

              forearm:
                rightForearm
                  ? rightForearm.rotation.clone()
                  : null,

              hand:
                rightHand
                  ? rightHand.rotation.clone()
                  : null,
            },
          };
        }

        setLoading(false);
      },

      undefined,

      (loadError) => {
        console.error(
          `Global Nexus Capital avatar failed to load: ${modelPath}`,
          loadError
        );

        if (disposed) return;

        setLoading(false);
        setError(true);
      }
    );

    /*
     * ANIMATION LOOP
     */

    const animate = () => {
      if (disposed) return;

      animationFrameRef.current =
        requestAnimationFrame(animate);

      const delta =
        clockRef.current.getDelta();

      const elapsed =
        clockRef.current.elapsedTime;

      /*
       * GLB animation
       */

      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      /*
       * AUTOMATIC WAVE
       */

      const wave = waveRef.current;

      if (wave) {
        if (
          !wave.active &&
          elapsed >= wave.nextWave
        ) {
          wave.active = true;
          wave.startTime = elapsed;
          wave.nextWave = elapsed + 30;
        }

        if (wave.active) {
          const progress =
            (elapsed - wave.startTime) /
            wave.duration;

          if (progress >= 1) {
            wave.active = false;

            if (
              wave.rightUpperArm &&
              wave.original.upperArm
            ) {
              wave.rightUpperArm.rotation.copy(
                wave.original.upperArm
              );
            }

            if (
              wave.rightForearm &&
              wave.original.forearm
            ) {
              wave.rightForearm.rotation.copy(
                wave.original.forearm
              );
            }

            if (
              wave.rightHand &&
              wave.original.hand
            ) {
              wave.rightHand.rotation.copy(
                wave.original.hand
              );
            }
          } else {
            const raise =
              progress < 0.25
                ? THREE.MathUtils.smoothstep(
                    progress / 0.25,
                    0,
                    1
                  )
                : progress > 0.8
                  ? 1 -
                    THREE.MathUtils.smoothstep(
                      (progress - 0.8) / 0.2,
                      0,
                      1
                    )
                  : 1;

            if (wave.rightUpperArm) {
              wave.rightUpperArm.rotation.x =
                (wave.original.upperArm?.x || 0) -
                0.75 * raise;

              wave.rightUpperArm.rotation.z =
                (wave.original.upperArm?.z || 0) -
                0.45 * raise;
            }

            if (wave.rightForearm) {
              wave.rightForearm.rotation.x =
                (wave.original.forearm?.x || 0) -
                0.35 * raise;
            }

            if (
              wave.rightHand &&
              raise > 0.8
            ) {
              const waveTime =
                elapsed - wave.startTime;

              wave.rightHand.rotation.z =
                (wave.original.hand?.z || 0) +
                Math.sin(
                  waveTime * 8
                ) *
                  0.35;

              wave.rightHand.rotation.y =
                (wave.original.hand?.y || 0) +
                Math.sin(
                  waveTime * 8
                ) *
                  0.18;
            }
          }
        }
      }

      renderer.render(
        scene,
        camera
      );
    };

    animate();

    /*
     * RESPONSIVE RESIZE
     */

    const resize = () => {
      if (!container || disposed) return;

      const newWidth =
        container.clientWidth;

      const newHeight =
        Math.max(
          container.clientHeight,
          1
        );

      camera.aspect =
        newWidth / newHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(
        newWidth,
        newHeight,
        false
      );
    };

    window.addEventListener(
      "resize",
      resize
    );

    resize();

    /*
     * CLEANUP
     */

    return () => {
      disposed = true;

      window.removeEventListener(
        "resize",
        resize
      );

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );
      }

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      if (
        onClick
      ) {
        renderer.domElement.removeEventListener(
          "click",
          onClick
        );
      }

      if (
        renderer.domElement.parentNode ===
        container
      ) {
        container.removeChild(
          renderer.domElement
        );
      }

      renderer.dispose();

      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          if (
            Array.isArray(
              object.material
            )
          ) {
            object.material.forEach(
              (material) => {
                material.dispose();
              }
            );
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [
    modelPath,
    large,
    onClick,
  ]);

  const containerHeight =
    large ? "430px" : "100%";

  return (
    <div
      style={{
        position: "relative",
        width: size || "100%",
        height: containerHeight,
        minHeight: containerHeight,
        overflow: "hidden",
        borderRadius: large ? "20px" : "28px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(238,244,255,0.88))",
      }}
    >
      <div
        ref={mountRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {loading && !error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            color: "#64748b",
            pointerEvents: "none",
          }}
        >
          Loading Global Nexus Capital Avatar…
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "20px",
            fontSize: "13px",
            color: "#64748b",
            pointerEvents: "none",
          }}
        >
          Global Nexus Capital Avatar unavailable
        </div>
      )}
    </div>
  );
}
