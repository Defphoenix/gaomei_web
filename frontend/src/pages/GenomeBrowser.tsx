import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import igv from "igv";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/client";
import { igvLocusForItem } from "../lib/clinicalV2Portal";
import type { ReportItem } from "../types";
import "./genome-browser.css";

type IgvTracks = {
  tumor_bam?: string;
  tumor_bai?: string;
  normal_bam?: string;
  normal_bai?: string;
  default_locus?: string;
};

type QuickLocus = {
  id: number;
  label: string;
  locus: string;
  item?: ReportItem;
};

type PaneId = "a" | "b";

type PaneBinding = {
  locus: string;
  itemId: number | null;
  label: string;
};

const DEFAULT_LOCUS = "chr17:7674100-7674400";
const MIN_IGV_HEIGHT = 360;
const MAX_IGV_HEIGHT = 1600;

function normalizeLocus(raw: string): string {
  return (raw || "").trim().replace(/,/g, "");
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(digits)}%`;
}

function lociOverlap(a: string, b: string): boolean {
  const na = normalizeLocus(a).toLowerCase();
  const nb = normalizeLocus(b).toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const parse = (s: string) => {
    const m = s.match(/^(chr)?([0-9xy]+|mt):(\d+)(?:-(\d+))?$/i);
    if (!m) return null;
    return {
      chr: m[2].toLowerCase(),
      start: Number(m[3]),
      end: Number(m[4] || m[3]),
    };
  };
  const pa = parse(na);
  const pb = parse(nb);
  if (!pa || !pb || pa.chr !== pb.chr) return false;
  return pa.start <= pb.end && pb.start <= pa.end;
}

function defaultIgvHeight(): number {
  if (typeof window === "undefined") return 720;
  return Math.max(MIN_IGV_HEIGHT, Math.min(MAX_IGV_HEIGHT, window.innerHeight - 108));
}

const HG38_GENOME = {
  id: "hg38",
  name: "Human (GRCh38/hg38)",
  fastaURL: "https://igv.org/genomes/data/hg38/hg38.fa",
  indexURL: "https://igv.org/genomes/data/hg38/hg38.fa.fai",
  twoBitURL: "https://igv.org/genomes/data/hg38/hg38.2bit",
  cytobandURL: "https://igv.org/genomes/data/hg38/cytoBandIdeo.txt.gz",
  aliasURL: "https://igv.org/genomes/data/hg38/hg38_alias.tab",
  chromSizesURL: "https://igv.org/genomes/data/hg38/hg38.chrom.sizes",
  chromosomeOrder:
    "chr1,chr2,chr3,chr4,chr5,chr6,chr7,chr8,chr9,chr10,chr11,chr12,chr13,chr14,chr15,chr16,chr17,chr18,chr19,chr20,chr21,chr22,chrX,chrY",
  tracks: [
    {
      name: "Refseq Genes",
      url: "https://igv.org/genomes/data/hg38/ncbiRefSeq.txt.gz",
      indexed: false,
      format: "refgene",
      order: 100000,
    },
  ],
};

const DEMO_LOCI: QuickLocus[] = [
  { id: -1, label: "TP53", locus: "chr17:7674100-7674370" },
  { id: -2, label: "KRAS", locus: "chr12:25245200-25245500" },
  { id: -3, label: "BRCA1", locus: "chr17:43044295-43125364" },
  { id: -4, label: "EGFR", locus: "chr7:55019017-55211628" },
];

async function forceIgvLayout(
  browser: igv.Browser | null,
  hostEl?: HTMLElement | null,
) {
  if (!browser) return;

  const root = (browser as any).root as HTMLElement | undefined;
  if (root) {
    root.style.width = "100%";
    root.style.maxWidth = "100%";
    root.style.boxSizing = "border-box";
    if (hostEl) {
      root.style.minHeight = "100%";
      root.style.height = "100%";
    }
  }

  // Width pass — IGV measures columnContainer via getBoundingClientRect.
  try {
    if (typeof (browser as any).layoutChange === "function") {
      await (browser as any).layoutChange();
    } else {
      await (browser as any).visibilityChange?.();
      await (browser as any).resize?.();
    }
  } catch { /* ignore */ }

  if (!hostEl) return;

  const trackViews: any[] = (browser as any).trackViews || [];
  if (!trackViews.length) return;

  const isChrome = (track: any) => {
    const type = String(track?.type || "").toLowerCase();
    return type === "ruler" || type === "ideogram" || type === "sequence" || track?.id === "ruler";
  };
  const isExpandable = (track: any) => {
    if (!track || isChrome(track)) return false;
    const type = String(track.type || "").toLowerCase();
    const format = String(track.format || track.config?.format || "").toLowerCase();
    if (type === "alignment" || format === "bam" || format === "cram") return true;
    if (type === "wig" || type === "coverage") return true;
    if (format === "vcf") return true;
    return false;
  };

  const nav = root?.querySelector(".igv-navbar") as HTMLElement | null;
  const available = Math.max(180, hostEl.clientHeight - (nav?.offsetHeight || 0) - 6);
  const fixed = trackViews.filter((tv) => !isExpandable(tv.track));
  const expandable = trackViews.filter((tv) => isExpandable(tv.track));
  const targets = expandable.length ? expandable : trackViews.filter((tv) => !isChrome(tv.track));
  if (!targets.length) return;

  const fixedSum = expandable.length
    ? fixed.reduce((sum, tv) => sum + (Number(tv.track?.height) || 40), 0)
    : 0;
  const leftover = Math.max(targets.length * 90, available - fixedSum);
  const bases = targets.map((tv) => {
    if (tv._fitBaseHeight == null) {
      tv._fitBaseHeight = Number(tv.track?.height) || 140;
    }
    return tv._fitBaseHeight as number;
  });
  const baseSum = bases.reduce((a, b) => a + b, 0) || 1;

  targets.forEach((tv, i) => {
    const nextH = Math.max(90, Math.floor(leftover * (bases[i] / baseSum)));
    try {
      tv.setTrackHeight(nextH, true);
    } catch { /* ignore */ }
  });

  try {
    await (browser as any).resize?.();
    await (browser as any).updateViews?.(true);
  } catch { /* ignore */ }
}

function buildTracks(reportTracks: IgvTracks | null, reportId: string): any[] {
  const tracks: any[] = [];
  const hasReportBam = Boolean(reportTracks?.tumor_bam);

  if (reportTracks?.tumor_bam) {
    tracks.push({
      name: `Tumor BAM · 报告 ${reportId}`,
      url: reportTracks.tumor_bam,
      indexURL: reportTracks.tumor_bai || undefined,
      format: "bam",
      order: 1,
      color: "#c0392b",
      height: 140,
      removable: false,
    });
  }
  if (reportTracks?.normal_bam) {
    tracks.push({
      name: `Normal BAM · 报告 ${reportId}`,
      url: reportTracks.normal_bam,
      indexURL: reportTracks.normal_bai || undefined,
      format: "bam",
      order: 2,
      color: "#2980b9",
      height: 140,
      removable: false,
    });
  }
  if (!hasReportBam) {
    tracks.push(
      {
        name: "本地变异位点 (VCF)",
        url: "/data/tracks/demo_variants.vcf",
        format: "vcf",
        order: 1000,
        color: "#e74c3c",
      },
      {
        name: "基因区域 (BED)",
        url: "/data/tracks/demo_genes.bed",
        format: "bed",
        order: 999,
        color: "#1a73e8",
        displayMode: "EXPANDED",
      },
    );
  }
  return tracks;
}

function itemLabel(item: ReportItem): string {
  return `${item.gene} ${item.hgvs_p || item.hgvs_c || ""}`.trim();
}

function bindingForItem(item: ReportItem | undefined, fallbackLocus: string, fallbackLabel = "未绑定"): PaneBinding {
  if (!item) {
    return { locus: normalizeLocus(fallbackLocus), itemId: null, label: fallbackLabel };
  }
  return {
    locus: normalizeLocus(igvLocusForItem(item)),
    itemId: item.id,
    label: itemLabel(item),
  };
}

const GenomeBrowser: React.FC = () => {
  const wrapA = useRef<HTMLDivElement>(null);
  const wrapB = useRef<HTMLDivElement>(null);
  const containerA = useRef<HTMLDivElement>(null);
  const containerB = useRef<HTMLDivElement>(null);
  const browserA = useRef<igv.Browser | null>(null);
  const browserB = useRef<igv.Browser | null>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const layoutRaf = useRef(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const reportId = searchParams.get("report") || "";
  const locusParam = normalizeLocus(searchParams.get("locus") || "");
  const locus2Param = normalizeLocus(searchParams.get("locus2") || "");
  const compareParam = searchParams.get("compare") === "1";

  const [searchInput, setSearchInput] = useState(locusParam || DEFAULT_LOCUS);
  const [compareMode, setCompareMode] = useState(compareParam);
  const [activePane, setActivePane] = useState<PaneId>("a");
  const [paneA, setPaneA] = useState<PaneBinding>({
    locus: locusParam || DEFAULT_LOCUS,
    itemId: null,
    label: "面板 A",
  });
  const [paneB, setPaneB] = useState<PaneBinding>({
    locus: locus2Param || DEMO_LOCI[1].locus,
    itemId: null,
    label: "面板 B",
  });
  const [igvHeight, setIgvHeight] = useState(defaultIgvHeight);
  const [isIgvLoading, setIsIgvLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bamStatus, setBamStatus] = useState("");
  const [bamOk, setBamOk] = useState(true);
  const [reportTracks, setReportTracks] = useState<IgvTracks | null>(null);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [tracksReady, setTracksReady] = useState(!reportId);
  const [reportTitle, setReportTitle] = useState("");
  const [patientName, setPatientName] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  useEffect(() => {
    setIgvHeight(defaultIgvHeight());
  }, []);

  useEffect(() => {
    setSearchInput(activePane === "a" ? paneA.locus : paneB.locus);
  }, [activePane, paneA.locus, paneB.locus]);

  useEffect(() => {
    if (!reportId) {
      setReportTracks(null);
      setReportItems([]);
      setReportTitle("");
      setPatientName("");
      setSampleId("");
      setDiagnosis("");
      setTracksReady(true);
      setBamOk(true);
      setBamStatus("未指定报告：显示演示轨道");
      return;
    }
    setTracksReady(false);
    setLoadError("");
    setBamStatus("正在读取报告 BAM 路径…");
    api.get(`/reports/${reportId}/`)
      .then(async (res) => {
        setReportTitle(res.data.title || `报告 #${reportId}`);
        const patient = res.data.patient_info || {};
        const sample = res.data.analysis_data?.sample || {};
        setPatientName(String(sample.name || patient.name || res.data.patient_name || "—"));
        setSampleId(String(sample.sample_id || res.data.sample_id || "—"));
        setDiagnosis(String(sample.clinical_diagnosis || patient.clinical_diagnosis || "—"));
        const tracks = (res.data.analysis_data?.igv_tracks || {}) as IgvTracks;
        if (tracks.default_locus) {
          tracks.default_locus = normalizeLocus(tracks.default_locus);
        }
        setReportTracks(tracks);
        const items: ReportItem[] = res.data.items || [];
        setReportItems(items);

        const url = new URLSearchParams(window.location.search);
        const urlLocus = normalizeLocus(url.get("locus") || "");
        const urlLocus2 = normalizeLocus(url.get("locus2") || "");
        const first = items[0];
        const second = items[1] || items[0];

        if (!urlLocus) {
          const bind = bindingForItem(first, tracks.default_locus || DEFAULT_LOCUS, "面板 A");
          setPaneA(bind);
          setSearchInput(bind.locus);
        } else {
          const match = items.find((item) => lociOverlap(igvLocusForItem(item), urlLocus));
          setPaneA({
            locus: urlLocus,
            itemId: match?.id ?? null,
            label: match ? itemLabel(match) : urlLocus,
          });
          setSearchInput(urlLocus);
        }

        if (urlLocus2) {
          const match = items.find((item) => lociOverlap(igvLocusForItem(item), urlLocus2));
          setPaneB({
            locus: urlLocus2,
            itemId: match?.id ?? null,
            label: match ? itemLabel(match) : urlLocus2,
          });
        } else if (second) {
          setPaneB(bindingForItem(second, DEMO_LOCI[1].locus, "面板 B"));
        }

        if (tracks.tumor_bam) {
          try {
            const head = await fetch(tracks.tumor_bam, { method: "HEAD" });
            if (!head.ok) {
              setBamOk(false);
              setBamStatus(`Tumor BAM 不可用 (${head.status})`);
            } else {
              setBamOk(true);
              setBamStatus("已绑定 Tumor / Normal 小 BAM，支持 Range 在线审阅");
            }
          } catch {
            setBamOk(false);
            setBamStatus("无法访问 Tumor BAM");
          }
        } else {
          setBamOk(false);
          setBamStatus("尚无 igv_tracks.tumor_bam（请确认上传包含 BAM）");
        }
      })
      .catch(() => {
        setReportTracks({});
        setReportItems([]);
        setBamOk(false);
        setBamStatus("读取报告失败，无法加载患者 BAM");
      })
      .finally(() => setTracksReady(true));
  }, [reportId]);

  const quickLoci = useMemo<QuickLocus[]>(() => {
    if (reportItems.length === 0) return DEMO_LOCI;
    return reportItems.map((item) => ({
      id: item.id,
      label: itemLabel(item),
      locus: normalizeLocus(igvLocusForItem(item)),
      item,
    }));
  }, [reportItems]);

  const itemById = useCallback((id: number | null) => (
    id == null ? null : reportItems.find((item) => item.id === id) || null
  ), [reportItems]);

  const syncUrl = useCallback((next: {
    locusA?: string;
    locusB?: string;
    compare?: boolean;
  }) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (reportId) params.set("report", reportId);
      const a = normalizeLocus(next.locusA ?? paneA.locus);
      const b = normalizeLocus(next.locusB ?? paneB.locus);
      const cmp = next.compare ?? compareMode;
      if (a) params.set("locus", a);
      else params.delete("locus");
      if (cmp && b) params.set("locus2", b);
      else params.delete("locus2");
      if (cmp) params.set("compare", "1");
      else params.delete("compare");
      return params;
    }, { replace: true });
  }, [compareMode, paneA.locus, paneB.locus, reportId, setSearchParams]);

  const jumpPane = useCallback(async (
    pane: PaneId,
    locus: string,
    opts?: { itemId?: number | null; label?: string },
  ) => {
    const cleaned = normalizeLocus(locus);
    if (!cleaned) return;

    let label = opts?.label;
    let itemId = opts?.itemId ?? null;
    if (itemId == null) {
      const match = reportItems.find((item) => lociOverlap(igvLocusForItem(item), cleaned));
      itemId = match?.id ?? null;
      if (match) label = itemLabel(match);
    } else if (!label) {
      const match = itemById(itemId);
      if (match) label = itemLabel(match);
    }

    const binding: PaneBinding = {
      locus: cleaned,
      itemId,
      label: label || cleaned,
    };

    if (pane === "a") {
      setPaneA(binding);
      setSearchInput(cleaned);
    } else {
      setPaneB(binding);
    }

    syncUrl(pane === "a" ? { locusA: cleaned } : { locusB: cleaned });

    const browser = pane === "a" ? browserA.current : browserB.current;
    if (browser) {
      try {
        await browser.search(cleaned);
        await forceIgvLayout(browser, pane === "a" ? wrapA.current : wrapB.current);
      } catch (err) {
        console.error("跳转失败:", err);
      }
    }
  }, [itemById, reportItems, syncUrl]);

  const jumpActivePane = useCallback(async (
    locus: string,
    itemId?: number | null,
    label?: string,
  ) => {
    await jumpPane(activePane, locus, { itemId, label });
  }, [activePane, jumpPane]);

  // Create / recreate IGV panes when tracks or compare mode change.
  useEffect(() => {
    if (!tracksReady || !containerA.current) return;

    let cancelled = false;
    const observers: ResizeObserver[] = [];
    const timers: number[] = [];

    const destroyBrowser = (ref: React.MutableRefObject<igv.Browser | null>, el: HTMLDivElement | null) => {
      if (ref.current) {
        try { (igv as any).removeBrowser(ref.current); } catch { /* ignore */ }
        ref.current = null;
      }
      if (el) el.innerHTML = "";
    };

    const mount = async (
      el: HTMLDivElement,
      ref: React.MutableRefObject<igv.Browser | null>,
      locus: string,
      hostEl: HTMLDivElement | null,
    ) => {
      destroyBrowser(ref, el);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const browser = await igv.createBrowser(el, {
        genome: HG38_GENOME,
        locus: normalizeLocus(locus) || DEFAULT_LOCUS,
        showNavigation: true,
        showRuler: true,
        tracks: buildTracks(reportTracks, reportId),
      });
      if (cancelled) {
        try { (igv as any).removeBrowser(browser); } catch { /* ignore */ }
        return null;
      }
      ref.current = browser;
      await forceIgvLayout(browser, hostEl || el);
      timers.push(window.setTimeout(() => { void forceIgvLayout(ref.current, hostEl || el); }, 120));
      timers.push(window.setTimeout(() => { void forceIgvLayout(ref.current, hostEl || el); }, 450));
      if (typeof ResizeObserver !== "undefined" && (hostEl || el)) {
        let lastKey = "";
        const observed = hostEl || el;
        const ro = new ResizeObserver((entries) => {
          const box = entries[0]?.contentRect;
          if (!box) return;
          const key = `${Math.round(box.width)}x${Math.round(box.height)}`;
          if (key === lastKey) return;
          lastKey = key;
          if (layoutRaf.current) cancelAnimationFrame(layoutRaf.current);
          layoutRaf.current = requestAnimationFrame(() => {
            void forceIgvLayout(ref.current, observed);
          });
        });
        ro.observe(observed);
        observers.push(ro);
      }
      return browser;
    };

    const init = async () => {
      setIsIgvLoading(true);
      setLoadError("");
      try {
        await mount(
          containerA.current!,
          browserA,
          paneA.locus || locusParam || DEFAULT_LOCUS,
          wrapA.current,
        );
        if (compareMode && containerB.current) {
          await mount(
            containerB.current,
            browserB,
            paneB.locus || locus2Param || DEMO_LOCI[1].locus,
            wrapB.current,
          );
        } else {
          destroyBrowser(browserB, containerB.current);
        }
        if (!cancelled) setIsIgvLoading(false);
      } catch (err) {
        console.error("IGV 初始化失败:", err);
        if (!cancelled) {
          setIsIgvLoading(false);
          const detail = err instanceof Error ? err.message : String(err);
          setLoadError(`基因组浏览器加载失败：${detail}`);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      observers.forEach((o) => o.disconnect());
      timers.forEach((t) => window.clearTimeout(t));
      destroyBrowser(browserA, containerA.current);
      destroyBrowser(browserB, containerB.current);
    };
    // pane loci intentionally omitted — jumps use search(); recreate only on data/mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracksReady, reportTracks, reportId, compareMode]);

  // Height / compare changes → relayout width + stretch BAM tracks to fill host.
  useEffect(() => {
    if (layoutRaf.current) cancelAnimationFrame(layoutRaf.current);
    layoutRaf.current = requestAnimationFrame(() => {
      void forceIgvLayout(browserA.current, wrapA.current);
      void forceIgvLayout(browserB.current, wrapB.current);
    });
  }, [igvHeight, compareMode]);

  const onHeightDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = igvHeight;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientY - dragStartY.current;
      const next = Math.max(MIN_IGV_HEIGHT, Math.min(MAX_IGV_HEIGHT, dragStartHeight.current + delta));
      setIgvHeight(next);
      if (layoutRaf.current) cancelAnimationFrame(layoutRaf.current);
      layoutRaf.current = requestAnimationFrame(() => {
        // Apply immediately during drag so IGV tracks follow the handle.
        if (wrapA.current) wrapA.current.style.height = `${next}px`;
        if (wrapB.current) wrapB.current.style.height = `${next}px`;
        void forceIgvLayout(browserA.current, wrapA.current);
        void forceIgvLayout(browserB.current, wrapB.current);
      });
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      void forceIgvLayout(browserA.current, wrapA.current);
      void forceIgvLayout(browserB.current, wrapB.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const toggleCompare = () => {
    const next = !compareMode;
    setCompareMode(next);
    if (next) {
      setActivePane("b");
      // Prefer a different second variant when available.
      if (!paneB.itemId || paneB.itemId === paneA.itemId) {
        const other = reportItems.find((item) => item.id !== paneA.itemId) || reportItems[1];
        if (other) {
          const bind = bindingForItem(other, DEMO_LOCI[1].locus, "面板 B");
          setPaneB(bind);
          syncUrl({ compare: true, locusB: bind.locus });
          return;
        }
      }
    } else {
      setActivePane("a");
    }
    syncUrl({ compare: next });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await jumpActivePane(searchInput);
  };

  const boundPaneForItem = (itemId: number | null, locus: string): PaneId[] => {
    const panes: PaneId[] = [];
    if (
      (itemId != null && paneA.itemId === itemId)
      || (itemId == null && lociOverlap(paneA.locus, locus))
    ) panes.push("a");
    if (compareMode && (
      (itemId != null && paneB.itemId === itemId)
      || (itemId == null && lociOverlap(paneB.locus, locus))
    )) panes.push("b");
    return panes;
  };

  const activeBinding = activePane === "a" ? paneA : paneB;
  const activeItem = itemById(activeBinding.itemId)
    || reportItems.find((item) => lociOverlap(igvLocusForItem(item), activeBinding.locus))
    || null;

  const backTo = reportId ? `/reports/${reportId}` : "/patient-reports";

  const renderPaneHeader = (pane: PaneId, binding: PaneBinding) => {
    const selected = activePane === pane;
    return (
      <button
        type="button"
        className={`gb-pane-head${selected ? " is-active" : ""}`}
        onClick={() => setActivePane(pane)}
      >
        <span className={`gb-pane-badge pane-${pane}`}>{pane.toUpperCase()}</span>
        <div>
          <strong>{binding.label || `面板 ${pane.toUpperCase()}`}</strong>
          <small>{binding.locus}</small>
        </div>
        {selected && <em>接收定位</em>}
      </button>
    );
  };

  const renderDetail = (binding: PaneBinding, title: string) => {
    const item = itemById(binding.itemId)
      || reportItems.find((it) => lociOverlap(igvLocusForItem(it), binding.locus))
      || null;
    if (!item) {
      return (
        <div className="gb-card gb-detail compact">
          <h3>{title}</h3>
          <p className="gb-detail-empty">坐标 {binding.locus} · 未匹配报告突变条目</p>
        </div>
      );
    }
    return (
      <div className="gb-card gb-detail compact">
        <h3>{title} · {itemLabel(item)}</h3>
        <div className="gb-detail-grid">
          <div>
            <span>坐标</span>
            <strong>{normalizeLocus(item.locus || igvLocusForItem(item))}</strong>
          </div>
          <div>
            <span>AF</span>
            <strong>{formatPercent(item.af)}</strong>
          </div>
          <div>
            <span>意义</span>
            <strong>{item.significance_display || item.consequence || "—"}</strong>
          </div>
          <div>
            <span>Tumor DP</span>
            <strong>
              {item.tumor_depth != null
                ? `${item.tumor_depth}${item.tumor_alt_reads != null ? ` (alt ${item.tumor_alt_reads})` : ""}`
                : "—"}
            </strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="gb-page">
      <header className="gb-topbar">
        <div className="gb-topbar-left">
          <Link to={backTo} className="gb-back">
            <i className="fas fa-arrow-left" /> 返回报告
          </Link>
          <div className="gb-title-block">
            <h1>IGV 证据浏览器</h1>
            <p>
              GRCh38 / hg38
              {reportTitle ? ` · ${reportTitle}` : ""}
              {sampleId ? ` · ${sampleId}` : ""}
            </p>
          </div>
        </div>
        <div className="gb-topbar-actions">
          <button
            type="button"
            className={`gb-compare-toggle${compareMode ? " is-on" : ""}`}
            onClick={toggleCompare}
            title="同时对照两个突变位点"
          >
            <i className="fas fa-columns" />
            {compareMode ? "关闭双突变对照" : "同时看两个突变"}
          </button>
          <form className="gb-search" onSubmit={handleSearch}>
            <span className={`gb-search-target pane-${activePane}`}>定位 → {activePane.toUpperCase()}</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="chr17:7674100-7674400"
              aria-label="基因组坐标"
            />
            <button type="submit">定位</button>
          </form>
        </div>
      </header>

      <div className="gb-body">
        <aside className="gb-sidebar">
          <section className="gb-card gb-patient">
            <div className="gb-patient-kicker">
              <i className="fas fa-user-injured" /> Patient
            </div>
            <h2>{reportId ? patientName || "患者报告" : "演示模式"}</h2>
            <div className="gb-meta-grid">
              <div>
                <span>样本编号</span>
                <strong>{reportId ? sampleId || "—" : "DEMO"}</strong>
              </div>
              <div>
                <span>报告 ID</span>
                <strong>{reportId || "—"}</strong>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span>临床诊断</span>
                <strong>{reportId ? diagnosis || "—" : "演示位点浏览"}</strong>
              </div>
            </div>
            <div className={`gb-bam-pill${bamOk ? "" : " warn"}`}>{bamStatus}</div>
          </section>

          <section className="gb-card gb-target-card">
            <div className="gb-variants-head">
              <h3>定位目标面板</h3>
            </div>
            <div className="gb-target-switch">
              <button
                type="button"
                className={activePane === "a" ? "is-active" : ""}
                onClick={() => setActivePane("a")}
              >
                <span className="gb-pane-badge pane-a">A</span>
                {paneA.label}
              </button>
              <button
                type="button"
                className={activePane === "b" ? "is-active" : ""}
                onClick={() => {
                  if (!compareMode) {
                    setCompareMode(true);
                    syncUrl({ compare: true });
                  }
                  setActivePane("b");
                }}
              >
                <span className="gb-pane-badge pane-b">B</span>
                {compareMode ? paneB.label : "开启并定位到 B"}
              </button>
            </div>
            <p className="gb-target-hint">
              点击下方突变只跳转<strong>当前目标面板</strong>
              {compareMode ? "；另一面板保持不动。" : "。开启双对照后可分别绑定 A / B。"}
            </p>
          </section>

          <section className="gb-card gb-variants">
            <div className="gb-variants-head">
              <h3>{reportItems.length ? "本报告突变位点" : "快捷位点"}</h3>
              <span>{reportItems.length ? `${reportItems.length} 个` : "演示"}</span>
            </div>
            {reportItems.length > 0 ? (
              <div className="gb-variant-list" role="list">
                {quickLoci.map((entry) => {
                  const item = entry.item!;
                  const panes = boundPaneForItem(item.id, entry.locus);
                  const isActiveTarget = panes.includes(activePane);
                  return (
                    <button
                      type="button"
                      role="listitem"
                      key={item.id}
                      className={`gb-variant-item${isActiveTarget ? " is-active" : ""}`}
                      onClick={() => jumpActivePane(entry.locus, item.id, entry.label)}
                    >
                      <div>
                        <strong>{entry.label}</strong>
                        <small>{normalizeLocus(item.locus || entry.locus)}</small>
                      </div>
                      <div className="gb-variant-right">
                        <span className="gb-af">AF {formatPercent(item.af)}</span>
                        {panes.length > 0 && (
                          <span className="gb-bound-flags">
                            {panes.map((p) => (
                              <i key={p} className={`gb-pane-badge pane-${p}`}>{p.toUpperCase()}</i>
                            ))}
                          </span>
                        )}
                      </div>
                      <em>
                        {item.significance_display || item.significance || item.consequence || item.variant_type_display || "—"}
                        {item.tumor_depth != null ? ` · DP ${item.tumor_depth}` : ""}
                      </em>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="gb-demo-chips">
                {DEMO_LOCI.map((entry) => {
                  const panes = boundPaneForItem(null, entry.locus);
                  return (
                    <button
                      type="button"
                      key={entry.label}
                      className={panes.includes(activePane) ? "is-active" : ""}
                      onClick={() => jumpActivePane(entry.locus, null, entry.label)}
                    >
                      {entry.label}
                      {panes.map((p) => (
                        <i key={p} className={`gb-pane-badge pane-${p}`}>{p.toUpperCase()}</i>
                      ))}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </aside>

        <section className="gb-main">
          <div className="gb-card gb-stage">
            <div className="gb-stage-bar">
              <div>
                <h2>
                  {compareMode
                    ? "双突变对照视图"
                    : activeItem
                      ? `${activeItem.gene} 证据视图`
                      : "基因组证据视图"}
                </h2>
                <p>
                  {compareMode
                    ? `A · ${paneA.locus} ｜ B · ${paneB.locus}`
                    : `当前位置 · ${paneA.locus}`}
                </p>
              </div>
              <div className="gb-stage-tools">
                <button type="button" className="gb-height-btn" onClick={() => setIgvHeight(defaultIgvHeight())}>
                  铺满高度
                </button>
                <button
                  type="button"
                  className="gb-height-btn"
                  onClick={() => setIgvHeight((h) => Math.min(MAX_IGV_HEIGHT, h + 120))}
                >
                  加高
                </button>
              </div>
            </div>

            <div className={`gb-panes${compareMode ? " is-compare" : ""}`}>
              <div className={`gb-pane${activePane === "a" ? " is-focused" : ""}`}>
                {compareMode && renderPaneHeader("a", paneA)}
                <div ref={wrapA} className="gb-igv-wrap" style={{ height: igvHeight }}>
                  {isIgvLoading && <div className="gb-overlay">正在加载基因组浏览器…</div>}
                  <div ref={containerA} className="gb-igv-host" />
                </div>
              </div>

              {compareMode && (
                <div className={`gb-pane${activePane === "b" ? " is-focused" : ""}`}>
                  {renderPaneHeader("b", paneB)}
                  <div ref={wrapB} className="gb-igv-wrap" style={{ height: igvHeight }}>
                    {isIgvLoading && <div className="gb-overlay">正在加载对照面板…</div>}
                    <div ref={containerB} className="gb-igv-host" />
                  </div>
                </div>
              )}
            </div>

            <div
              className="gb-resize-handle"
              onPointerDown={onHeightDragStart}
              role="separator"
              aria-orientation="horizontal"
              aria-label="拖拽调整 IGV 高度"
              title="拖拽调整高度"
            >
              <span />
              拖拽调整高度 · 当前 {igvHeight}px
            </div>

            {loadError && <div className="gb-error">{loadError}</div>}
          </div>

          {compareMode ? (
            <div className="gb-detail-row">
              {renderDetail(paneA, "面板 A")}
              {renderDetail(paneB, "面板 B")}
            </div>
          ) : (
            activeItem && renderDetail(paneA, "当前位点摘要")
          )}
        </section>
      </div>
    </div>
  );
};

export default GenomeBrowser;
