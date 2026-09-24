"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "/avatars/cmc-human.glb";
const WAVE_INTERVAL_MS = 30000;
const WAVE_DURATION = 2.8;

export default function Cmc3DAvatar({ size = 116, large = false, onClick }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameId = 0;
    let waveStart = -Infinity;
    let model = null;
    let mixer = null;
    let idleClock = 0;
    let resizeObserver = null;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      large ? 28 : 30,
      1,
      0.01,
      100
    );

    camera.position.set(0, 1.42, large ? 4.4 : 4.05);
    camera.lookAt(0, 1.25, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6c7a92, 2.0);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.7);
    key.position.set(2.8, 4.5, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xaec9ff, 1.15);
    fill.position.set(-3.5, 2.8, 2.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(0.5, 3.8, -4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 48),
      new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.scale.set(1.15, 0.72, 1.15);
    floor.receiveShadow = true;
    scene.add(floor);

    const loader = new GLTFLoader();

    const baseRotations = new Map();
    const bones = {};

    const boneNames = [
      "Hips",
      "Spine",
      "Spine1",
      "Spine2",
      "Neck",
      "Neck1",
      "Neck2",
      "Head",
      "RightShoulder",
      "RightArm",
      "RightForeArm",
      "RightHand",
      "RightForeArm1",
      "RightForeArm2",
      "RightHandPinky1",
      "RightHandRing1",
      "RightHandMiddle1",
      "RightHandIndex1",
      "RightHandThumb1",
    ];

    function captureBones(root) {
      root.traverse((object) => {
        if (!object.isBone) return;

        if (boneNames.includes(object.name)) {
          bones[object.name] = object;
          baseRotations.set(object.name, object.quaternion.clone());
        }
      });
    }

    function resetBone(name) {
      const bone = bones[name];
      const base = baseRotations.get(name);
      if (bone && base) bone.quaternion.copy(base);
    }

    function applyLocalRotation(name, x = 0, y = 0, z = 0) {
      const bone = bones[name];
      const base = baseRotations.get(name);
      if (!bone || !base) return;

      bone.quaternion.copy(base);

      const euler = new THREE.Euler(x, y, z, "XYZ");
      const delta = new THREE.Quaternion().setFromEuler(euler);
      bone.quaternion.multiply(delta);
    }

    function updateWave(progress) {
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const lift = Math.sin(Math.min(progress, 0.42) / 0.42 * Math.PI / 2);
      const waveStartPhase = Math.max(0, Math.min(1, (progress - 0.35) / 0.18));
      const waveEndPhase = Math.max(0, Math.min(1, (0.96 - progress) / 0.22));
      const wavePhase = Math.min(waveStartPhase, waveEndPhase);
      const handWave = Math.sin(wavePhase * Math.PI * 5) * 0.38 * wavePhase;

      applyLocalRotation(
        "RightShoulder",
        -0.22 * lift,
        0.03 * lift,
        -0.20 * lift
      );

      applyLocalRotation(
        "RightArm",
        -0.58 * lift,
        0.04 * lift,
        -0.42 * lift
      );

      applyLocalRotation(
        "RightForeArm",
        0.10 * lift,
        -0.08 * lift,
        -0.72 * lift + handWave
      );

      applyLocalRotation(
        "RightHand",
        0.05 * lift,
        0.16 * lift,
        handWave * 1.35
      );

      const fingerWave = Math.sin(wavePhase * Math.PI * 5 + 0.5) * 0.18 * wavePhase;

      for (const name of [
        "RightHandPinky1",
        "RightHandRing1",
        "RightHandMiddle1",
        "RightHandIndex1",
      ]) {
        applyLocalRotation(name, fingerWave, 0, 0);
      }

      applyLocalRotation("RightHandThumb1", fingerWave * 0.6, 0, 0);

      const bodySway = Math.sin(eased * Math.PI) * 0.035;
      applyLocalRotation("Spine2", 0, bodySway, 0);
    }

    function updateIdle(time) {
      const breath = Math.sin(time * 1.6) * 0.012;
      const sway = Math.sin(time * 0.7) * 0.018;

      applyLocalRotation("Spine", breath, sway * 0.45, 0);
      applyLocalRotation("Spine1", breath * 0.55, sway * 0.25, 0);
      applyLocalRotation("Spine2", breath * 0.25, sway, 0);
      applyLocalRotation("Head", 0, sway * 0.65, 0);
    }

    function resize() {
      if (!mount) return;

      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;

        model = gltf.scene;
        model.position.set(0, 0, 0);

        model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;

            if (object.material) {
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];

              for (const material of materials) {
                material.needsUpdate = true;
              }
            }
          }
        });

        captureBones(model);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const sizeVector = box.getSize(new THREE.Vector3());
        const height = Math.max(sizeVector.y, 1);

        model.position.x -= center.x;
        model.position.y -= box.min.y;
        model.position.z -= center.z;

        const targetHeight = large ? 3.25 : 2.65;
        const scale = targetHeight / height;
        model.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        model.position.y -= scaledCenter.y - targetHeight * 0.50;

        scene.add(model);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.play();
          });
        }
      },
      undefined,
      () => {
        // Keep the component empty rather than breaking the Mine page if the asset fails.
      }
    );

    const startTime = performance.now();
    let lastTime = startTime;

    const animate = (now) => {
      if (disposed) return;

      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      idleClock += delta;

      const elapsed = now - startTime;

      if (elapsed >= WAVE_INTERVAL_MS && now - waveStart >= WAVE_INTERVAL_MS) {
        waveStart = now;
      }

      updateIdle(idleClock);

      if (waveStart > 0) {
        const waveProgress = (now - waveStart) / (WAVE_DURATION * 1000);

        if (waveProgress >= 0 && waveProgress <= 1) {
          updateWave(waveProgress);
        } else if (waveProgress > 1) {
          [
            "RightShoulder",
            "RightArm",
            "RightForeArm",
            "RightHand",
            "RightHandPinky1",
            "RightHandRing1",
            "RightHandMiddle1",
            "RightHandIndex1",
            "RightHandThumb1",
          ].forEach(resetBone);
        }
      }

      if (mixer) mixer.update(delta);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();

      if (mixer && model) mixer.stopAllAction();

      scene.traverse((object) => {
        if (!object.isMesh) return;

        object.geometry?.dispose();

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach((material) => {
          if (material?.map) material.map.dispose();
          if (material?.normalMap) material.normalMap.dispose();
          if (material?.roughnessMap) material.roughnessMap.dispose();
          if (material?.metalnessMap) material.metalnessMap.dispose();
          material?.dispose();
        });
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [large]);

  const isNumeric = typeof size === "number";

  return (
    <div
      ref={mountRef}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      } : undefined}
      style={{
        width: isNumeric ? size : size || "100%",
        height: isNumeric ? size : "100%",
        minWidth: isNumeric ? size : undefined,
        minHeight: isNumeric ? size : undefined,
        display: "block",
        cursor: onClick ? "pointer" : "default",
        touchAction: "manipulation",
      }}
      aria-label={onClick ? "Open Global Nexus Capital 3D avatar" : undefined}
    />
  );
}
