"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DEFAULT_MODEL_URL = "/avatars/cmc-avatar-1.glb";
const WAVE_INTERVAL_MS = 30000;
const WAVE_DURATION = 2.8;

function Cmc3DAvatar({
  size = 116,
  large = false,
  modelSrc = DEFAULT_MODEL_URL,
  onClick,
}) {
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

    camera.position.set(0, 1.0, large ? 4.2 : 3.6);
    camera.lookAt(0, 0.9, 0);

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
      modelSrc,
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

        // Normalize the model first, then center it again. This order is
        // important because the two Global Nexus Capital GLBs have different native origins
        // and dimensions. It keeps the entire character centered instead of
        // drifting to one side of the profile frame.
        const rawBox = new THREE.Box3().setFromObject(model);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawHeight = Math.max(rawSize.y, 0.001);

        const targetHeight = large ? 2.65 : 1.82;
        model.scale.setScalar(targetHeight / rawHeight);

        // Recalculate the bounds after scaling, then center X/Z and put the
        // feet on the scene floor. This fixes GLBs whose pivot is off-center.
        const fittedBox = new THREE.Box3().setFromObject(model);
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
        const fittedHeight = Math.max(fittedBox.max.y - fittedBox.min.y, 0.001);

        model.position.x -= fittedCenter.x;
        model.position.y -= fittedBox.min.y;
        model.position.z -= fittedCenter.z;

        // Recalculate once more after repositioning so the camera uses the
        // actual visible character bounds, not the GLB's original pivot.
        const finalBox = new THREE.Box3().setFromObject(model);
        const finalCenter = finalBox.getCenter(new THREE.Vector3());
        const finalHeight = Math.max(finalBox.max.y - finalBox.min.y, 0.001);

        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const fitDistance =
          (finalHeight * 0.5) / Math.tan(verticalFov * 0.5);

        camera.position.z = Math.max(
          large ? 3.8 : 3.15,
          fitDistance * 1.18
        );
        camera.position.x = 0;
        camera.position.y = finalHeight * 0.48;
        camera.lookAt(finalCenter.x, finalHeight * 0.50, finalCenter.z);

        // Slight visual offset so the character sits a little left of the
        // profile frame center while keeping the camera framing unchanged.
        model.position.x += 0.02;

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
  }, [large, modelSrc]);

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


function money(value) {
  return `GHS ${Number(value || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB");
}

function memberId(id) {
  if (!id) return "CMC-—";

  const clean = String(id).replace(/-/g, "").toUpperCase();

  return `CMC-${clean.slice(-8)}`;
}


const AVATARS = [
  { id: "cmc-avatar-1", name: "Global Nexus Capital 3D Avatar 1", type: "glb", src: "/avatars/cmc-avatar-1.glb" },
  { id: "cmc-avatar-2", name: "Global Nexus Capital Human 2", type: "glb", src: "/avatars/cmc-human(2).glb" },
];

function SelectedAvatar({ avatar, size = 120, onClick }) {
  if (avatar?.type === "glb" && avatar?.src) {
    return (
      <Cmc3DAvatar
        modelSrc={avatar.src}
        size={size}
        onClick={onClick}
      />
    );
  }

  return null;
}

export default function MinePage() {
  const router = useRouter();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState("cmc-avatar-1");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  async function chooseAvatar(id) {
    if (!AVATARS.some((avatar) => avatar.id === id) || savingAvatar) return;

    setError("");
    setSavingAvatar(true);

    // Change the preview immediately so the picker always responds.
    setSelectedAvatar(id);

    try {
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ avatarId: id }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save avatar.");
      }

      const savedId = data?.avatarId || id;

      setSelectedAvatar(savedId);
      setAccount((current) => ({
        ...(current || {}),
        avatar_id: savedId,
      }));
      setShowAvatarPicker(false);
    } catch (err) {
      // Keep the selected preview visible, but tell the user if the
      // database/API could not persist the choice.
      setError(
        err.message ||
        "Avatar preview changed, but the selection could not be saved."
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  useEffect(() => {
    async function loadAccount() {
      try {
        const response = await fetch("/api/account", {
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load account."
          );
        }

        const nextAccount = data.account || data;
        setAccount(nextAccount);

        if (AVATARS.some((avatar) => avatar.id === nextAccount?.avatar_id)) {
          setSelectedAvatar(nextAccount.avatar_id);
        }
      } catch (err) {
        setError(
          err.message || "Unable to load account."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  async function logout() {
    try {
      setLoggingOut(true);

      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(
        err.message || "Unable to log out."
      );

      setLoggingOut(false);
    }
  }

  const balance = Number(
    account?.balance ??
    account?.available_balance ??
    account?.wallet_balance ??
    0
  );

  const rank =
    account?.rank_name ||
    account?.rank ||
    "STARTER";

  const name =
    account?.name ||
    "Global Nexus Capital Member";

  const phone =
    account?.phone ||
    "—";

  const registrationDate =
    account?.created_at ||
    account?.registration_date;

  const selectedAvatarObject =
    AVATARS.find((avatar) => avatar.id === selectedAvatar) ||
    AVATARS[0];

  return (
    <main className="mobile-shell scroll-page mine-modern-page">

      <img className="global-brand-logo user-brand-logo" src="/cmc-logo.jpeg" alt="Global Nexus Capital" />
      <header className="topbar mine-modern-topbar">

        <div>
          <div className="eyebrow">GLOBAL NEXUS CAPITAL ACCOUNT</div>

          <h1>Mine</h1>

          <p className="muted">
            Your account and Global Nexus Capital services
          </p>
        </div>

        <div className="mine-top-actions">

          <Link
            className="icon-button"
            href="/"
            aria-label="Home"
          >
            ⌂
          </Link>

          <Link
            className="icon-button"
            href="/settings"
            aria-label="Settings"
          >
            ⚙
          </Link>

          <button
            type="button"
            className="icon-button"
            onClick={() => setShowLogout(true)}
            aria-label="Logout"
          >
            ⇥
          </button>

        </div>

      </header>

      <section className="admin-card" style={{
        marginBottom: 14,
        overflow: "hidden",
      }}>
        <div className="admin-card-head">
          <div>
            <strong>Global Nexus Capital Profile</strong>
            <p className="muted">
              Your personal profile avatar
            </p>
          </div>

          <button
            type="button"
            className="mine-arrow-button"
            onClick={() => setShowAvatarPicker(true)}
            aria-label="Change avatar"
          >
            ✎
          </button>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 8,
        }}>
          <div style={{
            width: 96,
            height: 96,
            minWidth: 96,
            borderRadius: 28,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(145deg,#eef3ff,#ffffff)",
            boxShadow: "0 8px 24px rgba(20,40,80,.10)",
            overflow: "hidden",
          }}>
            <div style={{
              transform: "translateX(-40px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <SelectedAvatar
                avatar={
                  AVATARS.find((avatar) => avatar.id === selectedAvatar) ||
                  AVATARS[0]
                }
                size={96}
              />
            </div>
          </div>

          <div>
            <strong style={{
              display: "block",
              fontSize: 18,
            }}>
              {name}
            </strong>

            <span className="muted">
              {selectedAvatarObject.name}
            </span>

            <button
              type="button"
              className="button secondary"
              style={{
                marginTop: 10,
                padding: "8px 13px",
                fontSize: 13,
              }}
              onClick={() => setShowAvatarPicker(true)}
            >
              Change Avatar
            </button>
          </div>
        </div>
      </section>

      <section className="balance-card mine-modern-balance">

        <div className="mine-balance-label">

          <span>
            Available Balance
          </span>

          <span className="mine-live-dot">
            ● Active
          </span>

        </div>

        <strong>
          {loading
            ? "GHS —"
            : money(balance)}
        </strong>

        <div className="account-meta mine-modern-meta">

          <div>
            <span>Member</span>

            <strong>
              {name}
            </strong>
          </div>

          <div>
            <span>Rank</span>

            <strong>
              {rank}
            </strong>
          </div>

        </div>

      </section>

      <section className="admin-card mine-info-card">

        <div className="admin-card-head">

          <div>

            <strong>
              Account Information
            </strong>

            <p className="muted">
              Your registered Global Nexus Capital account details
            </p>

          </div>

          <span className="mine-section-icon">
            ◉
          </span>

        </div>

        <div className="mine-info-list">

          <div className="list-row">

            <div>

              <span className="mine-info-label">
                Global Nexus Capital Member ID
              </span>

              <strong>
                {memberId(account?.id)}
              </strong>

            </div>

            <span className="mine-row-icon">
              ID
            </span>

          </div>

          <div className="list-row">

            <div>

              <span className="mine-info-label">
                Phone Number
              </span>

              <strong>
                {phone}
              </strong>

            </div>

            <span className="mine-row-icon">
              ☎
            </span>

          </div>

          <div className="list-row">

            <div>

              <span className="mine-info-label">
                Registration Date
              </span>

              <strong>
                {formatDate(registrationDate)}
              </strong>

            </div>

            <span className="mine-row-icon">
              ◷
            </span>

          </div>

        </div>

      </section>

      <section className="feature-grid mine-money-grid">

        <Link
          href="/deposit"
          className="feature-card mine-money-card mine-deposit-card"
        >

          <span className="feature-icon">
            ＋
          </span>

          <span>
            Deposit
          </span>

          <small>
            Add funds
          </small>

        </Link>

        <Link
          href="/withdrawal"
          className="feature-card mine-money-card mine-withdraw-card"
        >

          <span className="feature-icon">
            ↗️
          </span>

          <span>
            Withdrawal
          </span>

          <small>
            Withdraw funds
          </small>

        </Link>

      </section>

      <section className="admin-card mine-events-card">

        <div className="admin-card-head">

          <div>

            <strong>
              Global Nexus Capital Events
            </strong>

            <p className="muted">
              View current active Global Nexus Capital events
            </p>

          </div>

          <Link
            className="mine-arrow-button"
            href="/events"
            aria-label="View Events"
          >
            ›
          </Link>

        </div>

      </section>

      <section className="mine-services-section">

        <div className="section-title mine-services-heading">

          <div>

            <span className="eyebrow">
              EXPLORE
            </span>

            <h2>
              Global Nexus Capital Services
            </h2>

          </div>

          <span className="mine-service-count">
            10+
          </span>

        </div>

        <div className="feature-grid mine-services-grid">

          <Link
            href="/lucky-cards"
            className="feature-card"
          >
            <span className="feature-icon">🎴</span>
            <span>Raffle Tickets</span>
          </Link>

          <Link
            href="/points-card"
            className="feature-card"
          >
            <span className="feature-icon">🎟️</span>
            <span>Points Card</span>
          </Link>

          <Link
            href="/team-expansion"
            className="feature-card"
          >
            <span className="feature-icon">👥</span>
            <span>My Team</span>
          </Link>

          <Link
            href="/financial-records"
            className="feature-card"
          >
            <span className="feature-icon">▤</span>
            <span>Financial Records</span>
          </Link>

          <Link
            href="/management-positions"
            className="feature-card"
          >
            <span className="feature-icon">◆</span>
            <span>Position Management</span>
          </Link>

          <Link
            href="/fund-products"
            className="feature-card"
          >
            <span className="feature-icon">◈</span>
            <span>Financial Management Fund</span>
          </Link>

          <Link
            href="/fund-products"
            className="feature-card"
          >
            <span className="feature-icon">◎</span>
            <span>Social Security Fund</span>
          </Link>

          <Link
            href="/account-security"
            className="feature-card"
          >
            <span className="feature-icon">🔒</span>
            <span>Account Security</span>
          </Link>

          <Link
            href="/business-license"
            className="feature-card"
          >
            <span className="feature-icon">▣</span>
            <span>Business License</span>
          </Link>

          <Link
            href="/privacy-policy"
            className="feature-card"
          >
            <span className="feature-icon">📄</span>
            <span>Privacy Policy</span>
          </Link>

          <Link
            href="/app-download"
            className="feature-card"
          >
            <span className="feature-icon">📱</span>
            <span>Global Nexus Capital App</span>
          </Link>

        </div>

      </section>

      {error && (
        <section className="admin-card mine-error-card">
          <p>{error}</p>
        </section>
      )}

      {showAvatarPicker && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAvatarPicker(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(8,14,24,.62)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <section
            className="admin-card"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "88vh",
              overflowY: "auto",
              margin: 0,
              borderRadius: 24,
            }}
          >
            <div className="admin-card-head">
              <div>
                <strong>Choose Your Avatar</strong>
                <p className="muted">
                  Select a character for your profile.
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setShowAvatarPicker(false)}
              >
                ×
              </button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 12,
              marginTop: 14,
            }}>
              {AVATARS.map((avatar) => {
                const selected = avatar.id === selectedAvatar;

                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      chooseAvatar(avatar.id);
                    }}
                    disabled={savingAvatar}
                    aria-label={`Select ${avatar.name}`}
                    style={{
                      border: selected
                        ? "2px solid #31548F"
                        : "1px solid rgba(20,35,60,.10)",
                      borderRadius: 20,
                      padding: "8px 6px 12px",
                      background: selected
                        ? "rgba(49,84,143,.08)"
                        : "#fff",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{
                      height: 170,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      <SelectedAvatar
                        avatar={avatar}
                        size={150}
                      />
                    </div>

                    <strong style={{
                      display: "block",
                      fontSize: 14,
                    }}>
                      {avatar.name}
                    </strong>

                    {selected && !savingAvatar && (
                      <span
                        className="badge"
                        style={{
                          display: "inline-block",
                          marginTop: 5,
                        }}
                      >
                        Selected
                      </span>
                    )}

                    {selected && savingAvatar && (
                      <span
                        className="badge"
                        style={{
                          display: "inline-block",
                          marginTop: 5,
                        }}
                      >
                        Saving...
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="button"
              style={{
                width: "100%",
                marginTop: 14,
              }}
              onClick={() => setShowAvatarPicker(false)}
              disabled={savingAvatar}
            >
              {savingAvatar ? "Saving..." : "Done"}
            </button>
          </section>
        </div>
      )}

      {showLogout && (

        <div
          className="logout-overlay"
          role="dialog"
          aria-modal="true"
        >

          <div className="logout-modal">

            <div className="logout-icon">
              ⇥
            </div>

            <h2>
              Log out?
            </h2>

            <p>
              Are you sure you want to log out of your Global Nexus Capital account?
            </p>

            <div className="logout-actions">

              <button
                type="button"
                className="logout-cancel"
                disabled={loggingOut}
                onClick={() => setShowLogout(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="logout-confirm"
                disabled={loggingOut}
                onClick={logout}
              >
                {loggingOut
                  ? "Logging out..."
                  : "Log out"}
              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}
