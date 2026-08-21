import * as THREE from "three";
import * as echarts from "echarts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#organ-canvas");
const viewer = document.querySelector("#viewer");
const tooltip = document.querySelector("#organ-tooltip");
const loading = document.querySelector("#model-loading");
const resetButton = document.querySelector("#reset-view");
const rotateButton = document.querySelector("#toggle-rotate");
const riskList = document.querySelector("#risk-list");
const calloutLayer = document.querySelector("#organ-callouts");
const calloutLines = document.querySelector("#callout-lines");
const reportLoader = document.querySelector("#report-loader");
const loaderStage = document.querySelector("#loader-stage");
const loaderProgress = document.querySelector("#loader-progress");
const loaderPercent = document.querySelector("#loader-percent");

const organData = {
  liver: {
    name: "肝脏",
    latin: "LIVER",
    score: 8.7,
    genes: "TP53 · CTNNB1",
    clinical: "3项待审核",
    neo: "4条强结合",
    text: "肝脏相关变异和数据库证据达到重点关注等级。建议结合肝功能、影像、病理和临床病史进行复核；该分值不是疾病发生概率。"
  },
  prostate: {
    name: "前列腺",
    latin: "PROSTATE",
    score: 7.6,
    genes: "AR · PTEN",
    clinical: "2项待审核",
    neo: "2条强结合",
    text: "前列腺相关证据达到重点关注等级。建议结合PSA、影像和专科检查综合判断，并由专业人员复核变异证据。"
  },
  pancreas: {
    name: "胰腺",
    latin: "PANCREAS",
    score: 6.8,
    genes: "KRAS · SMAD4",
    clinical: "2项待审核",
    neo: "3条候选",
    text: "胰腺相关证据处于疑似关注区间。建议结合影像、相关血液指标和个人病史进一步评估。"
  },
  colon: {
    name: "结直肠",
    latin: "COLORECTAL",
    score: 5.4,
    genes: "APC · PIK3CA",
    clinical: "1项待审核",
    neo: "2条候选",
    text: "结直肠相关证据处于关注区间。当前结果应与肠镜、病理和家族史共同解释。"
  },
  bladder: {
    name: "膀胱",
    latin: "URINARY BLADDER",
    score: 4.3,
    genes: "FGFR3 · TERT",
    clinical: "1项线索",
    neo: "1条候选",
    text: "膀胱相关证据未达到重点关注阈值，但存在少量可复核线索。"
  },
  gallbladder: {
    name: "胆囊",
    latin: "GALLBLADDER",
    score: 3.4,
    genes: "ERBB2",
    clinical: "无高等级证据",
    neo: "无强结合",
    text: "胆囊相关证据目前为低关注，未发现需要优先处理的高等级线索。"
  },
  kidney: {
    name: "肾脏",
    latin: "KIDNEY",
    score: 2.2,
    genes: "VHL",
    clinical: "无高等级证据",
    neo: "无强结合",
    text: "肾脏相关证据处于低关注区间，当前没有高等级临床证据。"
  },
  trachea: {
    name: "气管",
    latin: "TRACHEA",
    score: 1.6,
    genes: "未见重点基因",
    clinical: "无高等级证据",
    neo: "无强结合",
    text: "气管相关证据处于低关注区间，当前没有需要优先复核的变异。"
  }
};

const organOrder = ["liver", "prostate", "pancreas", "colon", "bladder", "gallbladder", "kidney", "trachea"];
const calloutLayout = {
  trachea: { side: "left", top: 18 },
  liver: { side: "left", top: 32 },
  kidney: { side: "left", top: 54 },
  prostate: { side: "left", top: 74 },
  pancreas: { side: "right", top: 30 },
  gallbladder: { side: "right", top: 45 },
  colon: { side: "right", top: 60 },
  bladder: { side: "right", top: 76 }
};
const organMeshes = new Map();
const originalEmissive = new WeakMap();
const organAnchors = new Map();
const calloutElements = new Map();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 100);
camera.position.set(0, 0.15, 4.8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 7.5;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.85;

scene.add(new THREE.HemisphereLight(0xdff5ff, 0x29445b, 2.45));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(3.6, 4.7, 5.1);
keyLight.castShadow = true;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x5fc9ff, 2.3);
rimLight.position.set(-4, 1.3, -3.5);
scene.add(rimLight);
const warmLight = new THREE.PointLight(0xffd6ac, 1.3, 10);
warmLight.position.set(0.4, -1.2, 3);
scene.add(warmLight);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let modelRoot;
let hoveredKey = null;
let selectedKey = "liver";
let defaultCameraPosition = camera.position.clone();
let defaultTarget = new THREE.Vector3();

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

function scoreColor(score) {
  if (score < 5) {
    const mix = THREE.MathUtils.clamp(score / 5, 0, 1);
    return new THREE.Color("#9ad9f3").lerp(new THREE.Color("#1765ae"), mix);
  }
  if (score < 7) {
    const mix = THREE.MathUtils.clamp((score - 5) / 2, 0, 1);
    return new THREE.Color("#ffe29a").lerp(new THREE.Color("#e4a21c"), mix);
  }
  const mix = THREE.MathUtils.clamp((score - 7) / 3, 0, 1);
  return new THREE.Color("#f47c6a").lerp(new THREE.Color("#a90f2e"), mix);
}

function colorCss(score) {
  return `#${scoreColor(score).getHexString()}`;
}

function riskLevel(score) {
  if (score >= 7) return "重点关注";
  if (score >= 5) return "疑似关注";
  return "低关注";
}

function setupMaterial(mesh, key) {
  const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const materials = sourceMaterials.map((source) => {
    const material = source.clone();
    material.side = THREE.DoubleSide;
    material.roughness = key === "skin" ? 0.48 : 0.36;
    material.metalness = 0.02;

    if (key === "skin") {
      material.color.set("#8eb7c8");
      material.transparent = true;
      material.opacity = 0.16;
      material.depthWrite = false;
    } else {
      const color = scoreColor(organData[key].score);
      material.color.copy(color);
      material.emissive = color.clone().multiplyScalar(0.09);
      material.emissiveIntensity = 0.38;
      originalEmissive.set(material, {
        color: material.emissive.clone(),
        intensity: material.emissiveIntensity
      });
    }
    return material;
  });
  mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  mesh.castShadow = key !== "skin";
  mesh.receiveShadow = key !== "skin";
}

function materialsFor(key) {
  return (organMeshes.get(key) || []).flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
}

function setGlow(key, active, selected = false) {
  if (!key || !organData[key]) return;
  const base = scoreColor(organData[key].score);
  for (const material of materialsFor(key)) {
    const original = originalEmissive.get(material);
    if (!original) continue;
    if (active) {
      material.emissive.copy(base);
      material.emissiveIntensity = selected ? 1.05 : 0.78;
    } else {
      material.emissive.copy(original.color);
      material.emissiveIntensity = original.intensity;
    }
  }
}

function updateSelection(key) {
  if (!organData[key]) return;
  if (selectedKey) setGlow(selectedKey, false);
  selectedKey = key;
  setGlow(selectedKey, true, true);

  const data = organData[key];
  const color = colorCss(data.score);
  const detail = document.querySelector("#organ-detail");
  detail.style.setProperty("--risk-color", color);
  document.querySelector("#detail-state").textContent = `当前选中 · ${riskLevel(data.score)}`;
  document.querySelector("#detail-name").textContent = data.name;
  document.querySelector("#detail-latin").textContent = data.latin;
  document.querySelector("#detail-score").textContent = data.score.toFixed(1);
  document.querySelector("#detail-text").textContent = data.text;
  document.querySelector("#detail-genes").textContent = data.genes;
  document.querySelector("#detail-clinical").textContent = data.clinical;
  document.querySelector("#detail-neo").textContent = data.neo;
  document.querySelector("#score-ring").style.setProperty("--risk-color", color);
  document.querySelector("#score-ring").style.setProperty("--score-deg", `${data.score * 36}deg`);

  document.querySelectorAll(".risk-row").forEach((row) => {
    row.style.opacity = row.dataset.key === key ? "1" : ".72";
  });
  document.querySelectorAll(".organ-callout").forEach((callout) => {
    callout.classList.toggle("active", callout.dataset.key === key);
  });
}

function buildRiskList() {
  for (const key of organOrder) {
    const data = organData[key];
    const row = document.createElement("div");
    row.className = "risk-row";
    row.dataset.key = key;
    row.style.setProperty("--row-color", colorCss(data.score));
    row.style.setProperty("--width", `${data.score * 10}%`);
    row.innerHTML = `<div class="risk-label"><span>${data.name}</span><b>${data.score.toFixed(1)}</b></div><div class="track"><div class="fill"></div></div>`;
    row.addEventListener("click", () => updateSelection(key));
    riskList.append(row);
  }
}

function buildCallouts() {
  calloutLayer.replaceChildren();
  calloutLines.replaceChildren();
  calloutElements.clear();

  for (const key of organOrder) {
    const data = organData[key];
    const layout = calloutLayout[key];
    const color = colorCss(data.score);

    const callout = document.createElement("button");
    callout.type = "button";
    callout.className = `organ-callout ${layout.side}`;
    callout.dataset.key = key;
    callout.style.top = `${layout.top}%`;
    callout.style.setProperty("--callout-color", color);
    callout.setAttribute("aria-label", `${data.name}，${data.score.toFixed(1)}分，${riskLevel(data.score)}`);
    callout.innerHTML = `<span class="organ-callout-name">${data.name}<small>${riskLevel(data.score)}</small></span><strong class="organ-callout-score">${data.score.toFixed(1)}</strong>`;

    callout.addEventListener("pointerenter", () => setGlow(key, true, key === selectedKey));
    callout.addEventListener("pointerleave", () => {
      if (key !== selectedKey) setGlow(key, false);
    });
    callout.addEventListener("click", () => updateSelection(key));
    calloutLayer.append(callout);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.classList.add("callout-line");
    line.setAttribute("stroke", color);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.classList.add("callout-dot");
    dot.setAttribute("r", "3.6");
    dot.setAttribute("fill", color);
    calloutLines.append(line, dot);

    calloutElements.set(key, { callout, line, dot, layout });
  }
}

function calculateOrganAnchors() {
  organAnchors.clear();
  for (const [key, meshes] of organMeshes.entries()) {
    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.expandByObject(mesh);
    organAnchors.set(key, bounds.getCenter(new THREE.Vector3()));
  }
}

function updateCalloutLines() {
  if (!modelRoot) return;
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  calloutLines.setAttribute("viewBox", `0 0 ${width} ${height}`);

  for (const [key, elements] of calloutElements.entries()) {
    const anchor = organAnchors.get(key);
    if (!anchor) continue;

    const projected = anchor.clone().project(camera);
    const anchorX = (projected.x * .5 + .5) * width;
    const anchorY = (-projected.y * .5 + .5) * height;
    const box = elements.callout.getBoundingClientRect();
    const viewerBox = viewer.getBoundingClientRect();
    const labelY = box.top - viewerBox.top + box.height / 2;
    const labelX = elements.layout.side === "left"
      ? box.right - viewerBox.left
      : box.left - viewerBox.left;
    const elbowX = elements.layout.side === "left"
      ? Math.min(labelX + 38, anchorX - 18)
      : Math.max(labelX - 38, anchorX + 18);

    elements.line.setAttribute(
      "d",
      `M ${labelX.toFixed(1)} ${labelY.toFixed(1)} L ${elbowX.toFixed(1)} ${labelY.toFixed(1)} L ${anchorX.toFixed(1)} ${anchorY.toFixed(1)}`
    );
    elements.dot.setAttribute("cx", anchorX.toFixed(1));
    elements.dot.setAttribute("cy", anchorY.toFixed(1));
    const visible = projected.z > -1 && projected.z < 1;
    elements.line.style.opacity = visible ? ".72" : "0";
    elements.dot.style.opacity = visible ? "1" : "0";
  }
}

function fitCamera(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);

  const maxDimension = Math.max(size.x, size.y, size.z);
  const scale = 3.75 / maxDimension;
  root.scale.setScalar(scale);

  const fittedBox = new THREE.Box3().setFromObject(root);
  const fittedSize = fittedBox.getSize(new THREE.Vector3());
  const distance = fittedSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(0, fittedSize.y * 0.03, distance * 1.18);
  controls.target.set(0, 0, 0);
  controls.update();
  defaultCameraPosition = camera.position.clone();
  defaultTarget = controls.target.clone();
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./node_modules/three/examples/jsm/libs/draco/gltf/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
  "./assets/tumor_web_0.10.glb",
  (gltf) => {
    modelRoot = gltf.scene;
    modelRoot.traverse((child) => {
      if (!child.isMesh) return;
      const key = classifyOrgan(child.name);
      child.userData.organKey = key;
      setupMaterial(child, key);
      if (key && key !== "skin") {
        if (!organMeshes.has(key)) organMeshes.set(key, []);
        organMeshes.get(key).push(child);
      }
    });
    scene.add(modelRoot);
    fitCamera(modelRoot);
    calculateOrganAnchors();
    buildCallouts();
    updateSelection("liver");
    loading.classList.add("hidden");
    showLoadProgress(92, "器官模型与风险标注已就绪");
    finishReportLoading();
  },
  undefined,
  (error) => {
    loading.textContent = "模型加载失败，请检查GLB文件。";
    console.error(error);
    showLoadProgress(92, "其余报告内容已就绪，器官模型暂不可用");
    finishReportLoading();
  }
);

function resizeRenderer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function pointerKey(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const candidates = [...organMeshes.values()].flat();
  const hit = raycaster.intersectObjects(candidates, false)[0];
  return hit?.object?.userData?.organKey || null;
}

canvas.addEventListener("pointermove", (event) => {
  const key = pointerKey(event);
  if (hoveredKey && hoveredKey !== selectedKey && hoveredKey !== key) setGlow(hoveredKey, false);
  hoveredKey = key;

  if (!key) {
    tooltip.classList.remove("visible");
    canvas.style.cursor = "grab";
    return;
  }

  const data = organData[key];
  if (key !== selectedKey) setGlow(key, true);
  document.querySelector("#tooltip-name").textContent = data.name;
  document.querySelector("#tooltip-source").textContent = data.latin;
  document.querySelector("#tooltip-score").textContent = `${data.score.toFixed(1)} · ${riskLevel(data.score)}`;
  tooltip.style.left = `${Math.min(event.offsetX, viewer.clientWidth - 190)}px`;
  tooltip.style.top = `${Math.min(event.offsetY, viewer.clientHeight - 90)}px`;
  tooltip.classList.add("visible");
  canvas.style.cursor = "pointer";
});

canvas.addEventListener("pointerleave", () => {
  if (hoveredKey && hoveredKey !== selectedKey) setGlow(hoveredKey, false);
  hoveredKey = null;
  tooltip.classList.remove("visible");
});

canvas.addEventListener("click", (event) => {
  const key = pointerKey(event);
  if (key) updateSelection(key);
});

canvas.addEventListener("pointerdown", () => {
  controls.autoRotate = false;
  rotateButton.textContent = "▶";
});

resetButton.addEventListener("click", () => {
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultTarget);
  controls.update();
});

rotateButton.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.textContent = controls.autoRotate ? "Ⅱ" : "▶";
});

buildRiskList();
resizeRenderer();
new ResizeObserver(resizeRenderer).observe(viewer);

function animate() {
  controls.update();
  updateCalloutLines();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

const workspaceConfig = {
  overview: {
    note: "患者友好模式：器官颜色表示证据关注度，不等同于患病概率或临床诊断。",
    sections: [
      ["overview-summary", "摘要", "⌂"],
      ["organ-risk", "器官证据地图", "3D"],
      ["somatic-findings", "重点体细胞发现", "DNA"],
      ["immune-summary", "免疫与新抗原", "H"],
      ["action-plan", "药物与行动建议", "Rx"],
      ["quality-summary", "报告质量摘要", "✓"],
      ["report-notes", "说明与声明", "i"]
    ]
  },
  professional: {
    note: "专业审核模式：保留来源字段、证据等级和审核状态，模拟数据不可用于临床解释。",
    sections: [
      ["pro-final-variants", "最终报告突变", "V"],
      ["pro-mutect2", "Mutect2证据", "M2"],
      ["pro-annotation", "注释证据矩阵", "DB"],
      ["pro-clinical", "临床与药物证据", "Rx"],
      ["pro-biomarkers", "分子标志物", "BM"],
      ["pro-neoantigen", "HLA与新抗原", "H"],
      ["pro-igv", "IGV证据", "IGV"],
      ["pro-review", "审核记录", "✓"]
    ]
  },
  qc: {
    note: "质控追溯模式：展示FASTQ到报告发布的核心指标、工具版本和结果文件状态。",
    sections: [
      ["qc-samples", "样本与流程", "S"],
      ["qc-fastq", "FASTQ质控", "FQ"],
      ["qc-alignment", "比对与重复", "BAM"],
      ["qc-coverage", "深度与覆盖", "DP"],
      ["qc-bqsr", "BQSR质量", "BQ"],
      ["qc-contamination", "污染与配对", "C"],
      ["qc-variants", "变异质控", "VCF"],
      ["qc-workflow", "流程状态", "WF"],
      ["qc-versions", "软件与数据库", "SW"],
      ["qc-files", "结果文件", "⇩"]
    ]
  },
  germline: {
    note: "规划中的胚系报告域：当前内容用于确认信息结构，尚未接入正式胚系分析和ACMG审核。",
    sections: [
      ["germline-summary", "遗传结果摘要", "G"],
      ["germline-pathogenic", "致病变异", "!"],
      ["germline-carrier", "携带者状态", "AR"],
      ["germline-vus", "意义未明变异", "?"],
      ["germline-phenotype", "表型与罕见病", "HPO"],
      ["germline-inheritance", "遗传模式与家系", "AD"],
      ["germline-pharmaco", "药物基因组", "PGx"],
      ["germline-traits", "趣味遗传与PGS", "PGS"],
      ["germline-methods", "方法与限制", "i"]
    ]
  }
};

const sideNav = document.querySelector("#side-nav");
const sideNote = document.querySelector("#side-note");
const reportMain = document.querySelector("#report-main");
const chartInstances = new Map();
const workspaceScroll = new Map();
let activeWorkspace = "overview";
let sectionScrollHandler;
let loadingFinished = false;

function showLoadProgress(percent, stage) {
  const safePercent = Math.max(0, Math.min(100, percent));
  loaderProgress.style.width = `${safePercent}%`;
  loaderPercent.textContent = `${safePercent}%`;
  if (stage) loaderStage.textContent = stage;
}

function finishReportLoading() {
  if (loadingFinished) return;
  loadingFinished = true;
  showLoadProgress(100, "报告数据、图表和交互模块已就绪");
  window.setTimeout(() => reportLoader.classList.add("done"), 320);
}

function updateHash(workspace, sectionId) {
  const hash = `#${workspace}/${sectionId}`;
  if (window.location.hash !== hash) history.replaceState(null, "", hash);
}

function setActiveSideItem(sectionId) {
  sideNav.querySelectorAll(".side-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === sectionId);
  });
}

function observeWorkspaceSections(workspace) {
  const sections = workspaceConfig[workspace].sections
    .map(([id]) => document.getElementById(id))
    .filter(Boolean);
  if (sectionScrollHandler) window.removeEventListener("scroll", sectionScrollHandler);
  sectionScrollHandler = () => {
    const positions = sections.map((section) => ({
      id: section.id,
      top: section.getBoundingClientRect().top
    }));
    const passed = positions.filter((item) => item.top <= 132);
    const current = passed.length
      ? passed.sort((a, b) => b.top - a.top)[0]
      : positions.sort((a, b) => Math.abs(a.top - 132) - Math.abs(b.top - 132))[0];
    if (!current) return;
    setActiveSideItem(current.id);
    updateHash(workspace, current.id);
  };
  window.addEventListener("scroll", sectionScrollHandler, { passive: true });
  sectionScrollHandler();
}

function renderSideNav(workspace) {
  const config = workspaceConfig[workspace];
  sideNav.replaceChildren();
  config.sections.forEach(([id, label, icon], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `side-item${index === 0 ? " active" : ""}`;
    button.dataset.target = id;
    button.innerHTML = `<span class="side-icon">${icon}</span><span>${label}</span>`;
    button.addEventListener("click", () => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSideItem(id);
      updateHash(workspace, id);
    });
    sideNav.append(button);
  });
  sideNote.textContent = config.note;
  observeWorkspaceSections(workspace);
}

function switchWorkspace(workspace, options = {}) {
  if (!workspaceConfig[workspace]) return;
  workspaceScroll.set(activeWorkspace, window.scrollY);
  activeWorkspace = workspace;

  document.querySelectorAll(".workspace-page").forEach((page) => {
    page.classList.toggle("active", page.dataset.workspace === workspace);
  });
  document.querySelectorAll(".tab[data-workspace]").forEach((tab) => {
    const active = tab.dataset.workspace === workspace;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  renderSideNav(workspace);
  initChartsFor(workspace);
  requestAnimationFrame(() => {
    resizeVisibleCharts();
    if (workspace === "overview") resizeRenderer();
    const firstSection = workspaceConfig[workspace].sections[0][0];
    const targetId = options.targetId || firstSection;
    if (options.restore && workspaceScroll.has(workspace)) {
      window.scrollTo({ top: workspaceScroll.get(workspace), behavior: "instant" });
    } else {
      document.getElementById(targetId)?.scrollIntoView({ behavior: options.smooth ? "smooth" : "instant", block: "start" });
    }
    setActiveSideItem(targetId);
    updateHash(workspace, targetId);
  });
}

document.querySelectorAll(".tab[data-workspace]").forEach((tab) => {
  tab.addEventListener("click", () => switchWorkspace(tab.dataset.workspace));
});

document.querySelectorAll("[data-open-workspace]").forEach((button) => {
  button.addEventListener("click", () => switchWorkspace(button.dataset.openWorkspace));
});

function setupVariantFilter() {
  const search = document.querySelector("#variant-search");
  const level = document.querySelector("#variant-level");
  const count = document.querySelector("#variant-count");
  const rows = [...document.querySelectorAll("#variant-table tbody tr")];
  if (!search || !level || !count) return;

  const filterRows = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const matchesText = !query || row.textContent.toLowerCase().includes(query);
      const matchesLevel = level.value === "all" || row.dataset.level === level.value;
      const show = matchesText && matchesLevel;
      row.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = `${visible} / ${rows.length}`;
  };
  search.addEventListener("input", filterRows);
  level.addEventListener("change", filterRows);
}

const chartTheme = {
  textStyle: { color: "#48627a", fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif" },
  animationDuration: 650,
  color: ["#1769c2", "#16a6a1", "#e4a21c", "#c8324b", "#70b984", "#805ad5"]
};

const chartOptions = {
  "overview-immune-chart": () => ({
    ...chartTheme,
    radar: {
      indicator: [
        { name: "TMB", max: 10 },
        { name: "MSI稳定度", max: 10 },
        { name: "HLA完整度", max: 10 },
        { name: "新抗原", max: 10 },
        { name: "证据一致性", max: 10 }
      ],
      radius: "67%",
      splitNumber: 4,
      axisName: { color: "#58728b", fontSize: 10 },
      splitArea: { areaStyle: { color: ["#f8fbfe", "#eef5fb"] } },
      splitLine: { lineStyle: { color: "#d7e5f0" } },
      axisLine: { lineStyle: { color: "#c8dbe9" } }
    },
    series: [{
      type: "radar",
      data: [{ value: [5.8, 8.2, 10, 7.4, 8.8], name: "免疫证据" }],
      areaStyle: { color: "rgba(23,105,194,.2)" },
      lineStyle: { width: 2 },
      symbolSize: 5
    }]
  }),
  "overview-neo-chart": () => ({
    ...chartTheme,
    grid: { left: 96, right: 28, top: 18, bottom: 28 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}" }, splitLine: { lineStyle: { color: "#edf2f7" } } },
    yAxis: { type: "category", data: ["TP53_R248Q_9mer", "ERBB2_S310F_10mer", "PIK3CA_H1047R_9mer"], axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: "bar", data: [94, 87, 73], barWidth: 16, itemStyle: { borderRadius: [0, 3, 3, 0], color: (p) => ["#c8324b", "#e4a21c", "#1769c2"][p.dataIndex] }, label: { show: true, position: "right", formatter: "{c}" } }]
  }),
  "pro-vaf-chart": () => ({
    ...chartTheme,
    grid: { left: 54, right: 24, top: 32, bottom: 42 },
    tooltip: { trigger: "item", formatter: (p) => `${p.data[3]}<br>TLOD ${p.data[0]}<br>VAF ${p.data[1]}%<br>DP ${p.data[2]}` },
    xAxis: { name: "TLOD", nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { color: "#edf2f7" } } },
    yAxis: { name: "Tumor VAF (%)", splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{
      type: "scatter",
      data: [[42.8, 18.6, 140, "TP53"], [26.1, 12.4, 118, "CTNNB1"], [13.9, 4.1, 248, "NEDD4L"], [21.5, 9.8, 132, "ERBB2"], [9.7, 6.3, 96, "BRCA1"], [31.2, 15.2, 154, "PIK3CA"]],
      symbolSize: (value) => Math.max(12, Math.sqrt(value[2]) * 1.8),
      label: { show: true, formatter: (p) => p.data[3], position: "top", color: "#29465f", fontSize: 9 },
      itemStyle: { color: "#1769c2", opacity: .82 }
    }]
  }),
  "filter-funnel-chart": () => ({
    ...chartTheme,
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    series: [{
      type: "funnel",
      left: "10%",
      width: "80%",
      top: 20,
      bottom: 20,
      minSize: "18%",
      maxSize: "100%",
      gap: 3,
      label: { formatter: "{b}  {c}", fontSize: 10 },
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
      data: [
        { value: 842, name: "Mutect2 raw" },
        { value: 312, name: "FilterMutectCalls PASS" },
        { value: 168, name: "VEP可注释" },
        { value: 66, name: "人工硬过滤" },
        { value: 22, name: "最终报告候选" }
      ]
    }]
  }),
  "cnv-chart": () => ({
    ...chartTheme,
    grid: { left: 48, right: 18, top: 28, bottom: 38 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "X"], axisLabel: { interval: 1 } },
    yAxis: { name: "log2", min: -1.2, max: 1.2, splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ type: "line", showSymbol: false, smooth: .2, data: [.03, -.08, .12, .08, -.02, .04, .38, .42, .36, .02, -.04, .06, -.09, -.12, .02, .08, .52, -.28, -.32, .05, .08, -.04, .01], lineStyle: { width: 2 }, areaStyle: { opacity: .08 }, markLine: { silent: true, data: [{ yAxis: 0 }], lineStyle: { color: "#8ca6ba", type: "dashed" }, symbol: "none" } }]
  }),
  "biomarker-chart": () => ({
    ...chartTheme,
    series: [
      { type: "gauge", center: ["28%", "56%"], radius: "70%", min: 0, max: 20, startAngle: 210, endAngle: -30, progress: { show: true, width: 12 }, axisLine: { lineStyle: { width: 12, color: [[.3, "#70b984"], [.65, "#e4a21c"], [1, "#c8324b"]] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, title: { offsetCenter: [0, "42%"], fontSize: 11 }, detail: { valueAnimation: true, fontSize: 22, offsetCenter: [0, "-4%"], formatter: "{value}" }, data: [{ value: 5.8, name: "TMB mut/Mb" }] },
      { type: "gauge", center: ["74%", "56%"], radius: "70%", min: 0, max: 20, startAngle: 210, endAngle: -30, progress: { show: true, width: 12, itemStyle: { color: "#16a6a1" } }, axisLine: { lineStyle: { width: 12, color: [[1, "#dcecf0"]] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, title: { offsetCenter: [0, "42%"], fontSize: 11 }, detail: { valueAnimation: true, fontSize: 22, offsetCenter: [0, "-4%"], formatter: "{value}%" }, data: [{ value: 1.8, name: "MSI score · MSS" }] }
    ]
  }),
  "neo-heatmap-chart": () => ({
    ...chartTheme,
    tooltip: { position: "top", formatter: (p) => `${p.name}<br>结合评分 ${p.value[2]}` },
    grid: { left: 96, right: 30, top: 20, bottom: 46 },
    xAxis: { type: "category", data: ["A*31:01", "A*33:03", "B*15:01", "B*58:01", "C*03:02", "C*15:02"], splitArea: { show: true }, axisLabel: { rotate: 28 } },
    yAxis: { type: "category", data: ["TP53-9", "ERBB2-10", "PIK3CA-9", "CTNNB1-11"], splitArea: { show: true } },
    visualMap: { min: 0, max: 100, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#eef5fb", "#46b3b0", "#1769c2", "#9b1733"] }, textStyle: { fontSize: 9 } },
    series: [{ type: "heatmap", data: [[0,0,94],[1,0,62],[2,0,48],[3,0,84],[4,0,40],[5,0,55],[0,1,36],[1,1,87],[2,1,71],[3,1,46],[4,1,64],[5,1,42],[0,2,68],[1,2,44],[2,2,73],[3,2,58],[4,2,36],[5,2,69],[0,3,41],[1,3,55],[2,3,67],[3,3,39],[4,3,82],[5,3,48]], label: { show: true, fontSize: 8 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,.25)" } } }]
  }),
  "fastq-chart": () => ({
    ...chartTheme,
    tooltip: { trigger: "axis" },
    legend: { data: ["过滤前", "过滤后"], bottom: 0 },
    grid: { left: 48, right: 20, top: 32, bottom: 48 },
    xAxis: { type: "category", data: ["Q20", "Q30", "有效reads", "接头清除"] },
    yAxis: { max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ name: "过滤前", type: "bar", data: [96.4, 91.8, 100, 87.2] }, { name: "过滤后", type: "bar", data: [98.1, 94.2, 96.8, 99.6] }]
  }),
  "insert-chart": () => ({
    ...chartTheme,
    grid: { left: 48, right: 18, top: 22, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: ["80", "120", "160", "200", "240", "280", "320", "360", "400"], name: "bp" },
    yAxis: { splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ type: "line", smooth: true, showSymbol: false, areaStyle: { opacity: .15 }, data: [2, 12, 36, 78, 100, 81, 49, 23, 8] }]
  }),
  "alignment-chart": () => donutOption(["Proper pair", "Duplicate", "低MAPQ", "其他"], [87.4, 8.4, 2.7, 1.5]),
  "coverage-chart": () => ({
    ...chartTheme,
    tooltip: { trigger: "axis" },
    legend: { data: ["平均深度", "20×覆盖率"], bottom: 0 },
    grid: { left: 52, right: 52, top: 32, bottom: 48 },
    xAxis: { type: "category", data: ["chr1", "chr3", "chr7", "chr11", "chr17", "chr18", "chrX"] },
    yAxis: [{ name: "深度", splitLine: { lineStyle: { color: "#edf2f7" } } }, { name: "覆盖率", min: 90, max: 100, axisLabel: { formatter: "{value}%" } }],
    series: [{ name: "平均深度", type: "bar", data: [122, 134, 118, 126, 141, 119, 102] }, { name: "20×覆盖率", type: "line", yAxisIndex: 1, data: [98.8, 99.1, 98.2, 98.7, 99.3, 98.4, 96.8], smooth: true }]
  }),
  "coverage-threshold-chart": () => ({
    ...chartTheme,
    grid: { left: 48, right: 24, top: 22, bottom: 38 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: ["1×", "10×", "20×", "50×", "100×"] },
    yAxis: { max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ type: "bar", data: [99.9, 99.4, 98.7, 94.3, 72.8], barWidth: "42%", itemStyle: { color: (p) => ["#1769c2", "#237bc5", "#16a6a1", "#70b984", "#e4a21c"][p.dataIndex], borderRadius: [3, 3, 0, 0] }, label: { show: true, position: "top", formatter: "{c}%" } }]
  }),
  "bqsr-chart": () => ({
    ...chartTheme,
    tooltip: { trigger: "axis" },
    legend: { data: ["重校准前", "重校准后"], bottom: 0 },
    grid: { left: 48, right: 20, top: 28, bottom: 48 },
    xAxis: { type: "category", data: ["Q10", "Q15", "Q20", "Q25", "Q30", "Q35", "Q40"] },
    yAxis: { name: "经验错误率", splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ name: "重校准前", type: "line", smooth: true, data: [9.4, 6.6, 4.1, 2.8, 1.9, 1.3, 1.1] }, { name: "重校准后", type: "line", smooth: true, data: [8.9, 5.4, 3.2, 1.8, .9, .42, .18] }]
  }),
  "variant-filter-chart": () => donutOption(["PASS", "低TLOD", "方向偏倚", "污染", "正常样本证据"], [312, 258, 112, 74, 86]),
  "vaf-distribution-chart": () => ({
    ...chartTheme,
    grid: { left: 48, right: 20, top: 24, bottom: 38 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: ["2–5%", "5–10%", "10–20%", "20–30%", ">30%"] },
    yAxis: { name: "变异数", splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ type: "bar", data: [18, 21, 17, 7, 3], barWidth: "48%", itemStyle: { color: "#16a6a1", borderRadius: [3, 3, 0, 0] }, label: { show: true, position: "top" } }]
  }),
  "acmg-chart": () => donutOption(["致病", "可能致病", "VUS", "可能良性", "良性"], [1, 1, 8, 42, 386]),
  "hpo-radar-chart": () => ({
    ...chartTheme,
    radar: {
      indicator: [{ name: "心血管", max: 100 }, { name: "神经", max: 100 }, { name: "听力", max: 100 }, { name: "代谢", max: 100 }, { name: "骨骼", max: 100 }],
      radius: "68%",
      splitArea: { areaStyle: { color: ["#f8fbfe", "#eef5fb"] } },
      axisName: { color: "#58728b" }
    },
    legend: { data: ["LDLR", "MYH7"], bottom: 0 },
    series: [{ type: "radar", data: [{ name: "LDLR", value: [91, 12, 8, 73, 15] }, { name: "MYH7", value: [82, 18, 5, 20, 38] }], areaStyle: { opacity: .08 } }]
  })
};

function donutOption(labels, values) {
  return {
    ...chartTheme,
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 6, top: "center", itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 9 } },
    series: [{
      type: "pie",
      radius: ["42%", "68%"],
      center: ["36%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 3, borderColor: "#fff", borderWidth: 2 },
      label: { show: false },
      data: labels.map((name, index) => ({ name, value: values[index] }))
    }]
  };
}

const workspaceCharts = {
  overview: ["overview-immune-chart", "overview-neo-chart"],
  professional: ["pro-vaf-chart", "filter-funnel-chart", "cnv-chart", "biomarker-chart", "neo-heatmap-chart"],
  qc: ["fastq-chart", "insert-chart", "alignment-chart", "coverage-chart", "coverage-threshold-chart", "bqsr-chart", "variant-filter-chart", "vaf-distribution-chart"],
  germline: ["acmg-chart", "hpo-radar-chart"]
};

function initChartsFor(workspace) {
  (workspaceCharts[workspace] || []).forEach((id) => {
    if (chartInstances.has(id)) return;
    const element = document.getElementById(id);
    const optionFactory = chartOptions[id];
    if (!element || !optionFactory) return;
    const chart = echarts.init(element, null, { renderer: "canvas" });
    chart.setOption(optionFactory());
    chartInstances.set(id, chart);
  });
}

function resizeVisibleCharts() {
  chartInstances.forEach((chart) => {
    if (chart.getDom().offsetParent !== null) chart.resize();
  });
}

function bootstrapReport() {
  showLoadProgress(24, "建立报告工作区和章节索引");
  setupVariantFilter();

  const [hashWorkspace, hashSection] = window.location.hash.replace(/^#/, "").split("/");
  const initialWorkspace = workspaceConfig[hashWorkspace] ? hashWorkspace : "overview";
  document.querySelectorAll(".workspace-page").forEach((page) => {
    page.classList.toggle("active", page.dataset.workspace === initialWorkspace);
  });
  activeWorkspace = initialWorkspace;
  renderSideNav(initialWorkspace);
  showLoadProgress(58, "生成当前工作区科研图表");
  initChartsFor(initialWorkspace);
  document.querySelectorAll(".tab[data-workspace]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.workspace === initialWorkspace);
  });

  requestAnimationFrame(() => {
    resizeVisibleCharts();
    if (hashSection && document.getElementById(hashSection)) {
      document.getElementById(hashSection).scrollIntoView({ behavior: "instant", block: "start" });
      setActiveSideItem(hashSection);
    }
  });
  showLoadProgress(74, "加载3D器官模型与证据标注");

  window.setTimeout(() => {
    if (!loadingFinished) {
      showLoadProgress(96, "报告交互已就绪，3D模型继续在后台加载");
      finishReportLoading();
    }
  }, 2400);
}

window.addEventListener("resize", () => {
  resizeRenderer();
  resizeVisibleCharts();
});

window.addEventListener("hashchange", () => {
  const [workspace, sectionId] = window.location.hash.replace(/^#/, "").split("/");
  if (!workspaceConfig[workspace]) return;
  switchWorkspace(workspace, { targetId: sectionId });
});

bootstrapReport();
