import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface OrganRisk {
  key: string;
  name: string;
  score: number;
  genes: string[];
  evidence: string;
  recommendation: string;
}

interface Props {
  risks: OrganRisk[];
  simulated?: boolean;
}

const organOrder = [
  "liver",
  "prostate",
  "pancreas",
  "colon",
  "bladder",
  "gallbladder",
  "kidney",
  "trachea",
];

const calloutLayout: Record<string, { side: "left" | "right"; top: number }> = {
  trachea: { side: "left", top: 18 },
  liver: { side: "left", top: 32 },
  kidney: { side: "left", top: 54 },
  prostate: { side: "left", top: 74 },
  pancreas: { side: "right", top: 30 },
  gallbladder: { side: "right", top: 45 },
  colon: { side: "right", top: 60 },
  bladder: { side: "right", top: 76 },
};

function classifyOrgan(name = "") {
  const value = name.toLowerCase();
  if (value.includes("skin")) return "skin";
  if (value.includes("prostate")) return "prostate";
  if (value.includes("liver")) return "liver";
  if (value.includes("pancreas")) return "pancreas";
  if (value.includes("colon") || value.includes("rectum")) return "colon";
  if (value.includes("gallbladder")) return "gallbladder";
  if (value.includes("kidney")) return "kidney";
  if (value.includes("urinary_bladder")) return "bladder";
  if (value.includes("trachea")) return "trachea";
  return null;
}

function scoreColor(score: number) {
  if (score < 5) {
    return new THREE.Color("#9ad9f3").lerp(
      new THREE.Color("#1765ae"),
      THREE.MathUtils.clamp(score / 5, 0, 1),
    );
  }
  if (score < 7) {
    return new THREE.Color("#ffe29a").lerp(
      new THREE.Color("#e4a21c"),
      THREE.MathUtils.clamp((score - 5) / 2, 0, 1),
    );
  }
  return new THREE.Color("#f47c6a").lerp(
    new THREE.Color("#a90f2e"),
    THREE.MathUtils.clamp((score - 7) / 3, 0, 1),
  );
}

const colorCss = (score: number) => `#${scoreColor(score).getHexString()}`;
const riskLevel = (score: number) => score >= 7 ? "重点关注" : score >= 5 ? "疑似关注" : "低关注";

const OrganRiskViewer: React.FC<Props> = ({ risks, simulated = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const calloutLayerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<SVGSVGElement>(null);
  const runtimeRef = useRef<Record<string, unknown>>({});
  const [selectedKey, setSelectedKey] = useState(risks[0]?.key || "liver");
  const [rotating, setRotating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modelError, setModelError] = useState("");
  const [tooltip, setTooltip] = useState<{ key: string; x: number; y: number } | null>(null);

  const riskMap = useMemo(
    () => Object.fromEntries(risks.map((risk) => [risk.key, risk])),
    [risks],
  );
  const selected = riskMap[selectedKey] || risks[0];

  useEffect(() => {
    if (!canvasRef.current || !viewerRef.current) return;
    const canvas = canvasRef.current;
    const viewer = viewerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 100);
    camera.position.set(0, 0.15, 4.8);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 7.5;
    controls.autoRotateSpeed = 1.85;

    scene.add(new THREE.HemisphereLight(0xdff5ff, 0x29445b, 2.45));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(3.6, 4.7, 5.1);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x5fc9ff, 2.3);
    rimLight.position.set(-4, 1.3, -3.5);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(0xffd6ac, 1.3, 10);
    warmLight.position.set(0.4, -1.2, 3);
    scene.add(warmLight);

    const organMeshes = new Map<string, any[]>();
    const organAnchors = new Map<string, any>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let modelRoot: any;
    let animationFrame = 0;
    let defaultCamera = camera.position.clone();
    let defaultTarget = new THREE.Vector3();

    const resize = () => {
      const width = Math.max(1, viewer.clientWidth);
      const height = Math.max(1, viewer.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const updateLines = () => {
      if (!modelRoot || !linesRef.current || !calloutLayerRef.current) return;
      const width = viewer.clientWidth;
      const height = viewer.clientHeight;
      const viewerBox = viewer.getBoundingClientRect();
      linesRef.current.setAttribute("viewBox", `0 0 ${width} ${height}`);
      organOrder.forEach((key) => {
        const anchor = organAnchors.get(key);
        const callout = calloutLayerRef.current?.querySelector<HTMLElement>(`[data-organ="${key}"]`);
        const path = linesRef.current?.querySelector<SVGPathElement>(`path[data-organ="${key}"]`);
        const dot = linesRef.current?.querySelector<SVGCircleElement>(`circle[data-organ="${key}"]`);
        if (!anchor || !callout || !path || !dot) return;
        const projected = anchor.clone().project(camera);
        const anchorX = (projected.x * .5 + .5) * width;
        const anchorY = (-projected.y * .5 + .5) * height;
        const box = callout.getBoundingClientRect();
        const side = calloutLayout[key]?.side || "left";
        const labelY = box.top - viewerBox.top + box.height / 2;
        const labelX = side === "left" ? box.right - viewerBox.left : box.left - viewerBox.left;
        const elbowX = side === "left"
          ? Math.min(labelX + 38, anchorX - 18)
          : Math.max(labelX - 38, anchorX + 18);
        path.setAttribute("d", `M ${labelX} ${labelY} L ${elbowX} ${labelY} L ${anchorX} ${anchorY}`);
        dot.setAttribute("cx", String(anchorX));
        dot.setAttribute("cy", String(anchorY));
        const visible = projected.z > -1 && projected.z < 1;
        path.style.opacity = visible ? ".72" : "0";
        dot.style.opacity = visible ? "1" : "0";
      });
    };

    const fitCamera = (root: any) => {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.scale.setScalar(3.75 / Math.max(size.x, size.y, size.z));
      root.updateMatrixWorld(true);
      const fitted = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      const distance = fitted.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      camera.position.set(0, fitted.y * .03, distance * 1.18);
      controls.target.set(0, 0, 0);
      controls.update();
      defaultCamera = camera.position.clone();
      defaultTarget = controls.target.clone();
    };

    const draco = new DRACOLoader();
    draco.setDecoderPath("/assets/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      "/assets/models/tumor_web_0.10.glb",
      (gltf: any) => {
        modelRoot = gltf.scene;
        modelRoot.traverse((child: any) => {
          if (!child.isMesh) return;
          const key = classifyOrgan(child.name);
          child.userData.organKey = key;
          const source = Array.isArray(child.material) ? child.material : [child.material];
          const materials = source.map((original: any) => {
            const material = original.clone();
            material.side = THREE.DoubleSide;
            material.roughness = key === "skin" ? .48 : .36;
            material.metalness = .02;
            if (key === "skin") {
              material.color.set("#8eb7c8");
              material.transparent = true;
              material.opacity = .16;
              material.depthWrite = false;
            } else if (key && riskMap[key]) {
              const color = scoreColor(riskMap[key].score);
              material.color.copy(color);
              material.emissive = color.clone().multiplyScalar(.09);
              material.emissiveIntensity = .38;
            }
            return material;
          });
          child.material = Array.isArray(child.material) ? materials : materials[0];
          if (key && key !== "skin") {
            if (!organMeshes.has(key)) organMeshes.set(key, []);
            organMeshes.get(key)?.push(child);
          }
        });
        scene.add(modelRoot);
        fitCamera(modelRoot);
        organMeshes.forEach((meshes, key) => {
          const bounds = new THREE.Box3();
          meshes.forEach((mesh) => bounds.expandByObject(mesh));
          organAnchors.set(key, bounds.getCenter(new THREE.Vector3()));
        });
        setLoading(false);
      },
      undefined,
      () => {
        setLoading(false);
        setModelError("3D模型暂时无法加载");
      },
    );

    const hitOrgan = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...organMeshes.values()].flat(), false)[0];
      return hit?.object?.userData?.organKey as string | undefined;
    };

    const onMove = (event: PointerEvent) => {
      const key = hitOrgan(event);
      if (!key || !riskMap[key]) {
        setTooltip(null);
        return;
      }
      setTooltip({ key, x: event.offsetX, y: event.offsetY });
    };
    const onClick = (event: PointerEvent) => {
      const key = hitOrgan(event);
      if (key && riskMap[key]) setSelectedKey(key);
    };
    const onPointerDown = () => {
      controls.autoRotate = false;
      setRotating(false);
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", () => setTooltip(null));
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointerdown", onPointerDown);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewer);
    resize();

    const animate = () => {
      controls.update();
      updateLines();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    runtimeRef.current = {
      reset: () => {
        camera.position.copy(defaultCamera);
        controls.target.copy(defaultTarget);
        controls.update();
      },
      rotate: (value: boolean) => {
        controls.autoRotate = value;
      },
    };

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      controls.dispose();
      renderer.dispose();
      draco.dispose();
    };
  }, [riskMap]);

  useEffect(() => {
    const rotate = runtimeRef.current.rotate as ((value: boolean) => void) | undefined;
    rotate?.(rotating);
  }, [rotating]);

  if (!selected) return null;
  const tooltipRisk = tooltip ? riskMap[tooltip.key] : null;

  return (
    <section className="report-v2-risk-workspace">
      <div className="report-v2-viewer" ref={viewerRef}>
        <div className="report-v2-viewer-head">
          <div><strong>器官系统证据地图</strong><small>连续色带展示 0–10 分关注度</small></div>
          <div>
            <button type="button" title="重置视角" onClick={() => (runtimeRef.current.reset as (() => void) | undefined)?.()}>↺</button>
            <button type="button" title="暂停或继续旋转" onClick={() => setRotating((value) => !value)}>{rotating ? "Ⅱ" : "▶"}</button>
          </div>
        </div>
        <canvas ref={canvasRef} className="report-v2-organ-canvas" />
        <svg ref={linesRef} className="report-v2-callout-lines" aria-hidden="true">
          {organOrder.map((key) => riskMap[key] && (
            <React.Fragment key={key}>
              <path data-organ={key} stroke={colorCss(riskMap[key].score)} />
              <circle data-organ={key} r="3.6" fill={colorCss(riskMap[key].score)} />
            </React.Fragment>
          ))}
        </svg>
        <div ref={calloutLayerRef} className="report-v2-organ-callouts">
          {organOrder.map((key) => {
            const risk = riskMap[key];
            const layout = calloutLayout[key];
            if (!risk || !layout) return null;
            return (
              <button
                type="button"
                key={key}
                data-organ={key}
                className={`${layout.side} ${selectedKey === key ? "active" : ""}`}
                style={{ top: `${layout.top}%`, "--organ-color": colorCss(risk.score) } as React.CSSProperties}
                onClick={() => setSelectedKey(key)}
              >
                <span>{risk.name}<small>{riskLevel(risk.score)}</small></span>
                <strong>{risk.score.toFixed(1)}</strong>
              </button>
            );
          })}
        </div>
        {tooltipRisk && (
          <div className="report-v2-organ-tooltip" style={{ left: Math.min(tooltip!.x, 380), top: Math.min(tooltip!.y, 620) }}>
            <small>ORGAN SCORE</small><strong>{tooltipRisk.name}</strong>
            <span>{tooltipRisk.score.toFixed(1)} · {riskLevel(tooltipRisk.score)}</span>
          </div>
        )}
        <div className="report-v2-scale">
          <strong>器官关注度评分</strong>
          <i />
          <span><b>0 低关注</b><b>5 疑似关注</b><b>10 重点关注</b></span>
        </div>
        {loading && <div className="report-v2-model-loading">正在加载患者器官模型…</div>}
        {modelError && <div className="report-v2-model-loading error">{modelError}</div>}
      </div>

      <aside className="report-v2-organ-detail" style={{ "--risk-color": colorCss(selected.score) } as React.CSSProperties}>
        <div className="report-v2-organ-detail-head">
          <div><small>当前选中 · {riskLevel(selected.score)}</small><h2>{selected.name}</h2></div>
          <div className="report-v2-score-ring"><strong>{selected.score.toFixed(1)}</strong></div>
        </div>
        <p>{selected.recommendation}</p>
        <div className="report-v2-evidence-grid">
          <div>关联基因<strong>{selected.genes.join(" · ") || "暂无"}</strong></div>
          <div>证据状态<strong>{selected.evidence}</strong></div>
          <div>评分类型<strong>证据关注度</strong></div>
          <div>数据来源<strong>报告 JSON</strong></div>
        </div>
        <div className="report-v2-risk-list">
          <h3>器官关注度对比</h3>
          {risks.map((risk) => (
            <button type="button" key={risk.key} onClick={() => setSelectedKey(risk.key)}>
              <span>{risk.name}<b>{risk.score.toFixed(1)}</b></span>
              <i><em style={{ width: `${risk.score * 10}%`, background: colorCss(risk.score) }} /></i>
            </button>
          ))}
        </div>
        <div className="report-v2-model-note">
          {simulated ? "当前器官分值为界面回退数据，正式发布前必须由分析规则和人工审核结果替换。" : "器官分值来自本报告JSON；它表示证据关注度，不等同于患病概率。"}
        </div>
      </aside>
    </section>
  );
};

export default OrganRiskViewer;
