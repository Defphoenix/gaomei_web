import React, { useRef, useEffect, useState, useCallback } from "react";
import igv from "igv";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/client";

type IgvTracks = {
  tumor_bam?: string;
  tumor_bai?: string;
  normal_bam?: string;
  normal_bai?: string;
  default_locus?: string;
};

const GenomeBrowser: React.FC = () => {
  const igvContainer = useRef<HTMLDivElement>(null);
  const browserRef = useRef<igv.Browser | null>(null);
  const isInitializedRef = useRef(false);
  const customTrackRef = useRef<any>(null);
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get("report") || "";
  const locusParam = searchParams.get("locus") || "chr17:7,674,100-7,674,400";

  const [searchInput, setSearchInput] = useState(locusParam);
  const [currentLocus, setCurrentLocus] = useState(locusParam);
  const [isIgvLoading, setIsIgvLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bamUrl, setBamUrl] = useState("");
  const [bamIndexUrl, setBamIndexUrl] = useState("");
  const [customTrackName, setCustomTrackName] = useState("自定义 BAM");
  const [addingTrack, setAddingTrack] = useState(false);
  const [reportTracks, setReportTracks] = useState<IgvTracks | null>(null);
  const [tracksReady, setTracksReady] = useState(!reportId);
  const [reportTitle, setReportTitle] = useState("");

  useEffect(() => {
    if (!reportId) {
      setReportTracks(null);
      setTracksReady(true);
      return;
    }
    setTracksReady(false);
    api.get(`/reports/${reportId}/`)
      .then((res) => {
        setReportTitle(res.data.title || `报告 #${reportId}`);
        const tracks = (res.data.analysis_data?.igv_tracks || {}) as IgvTracks;
        setReportTracks(tracks);
        if (!searchParams.get("locus") && tracks.default_locus) {
          setSearchInput(tracks.default_locus);
          setCurrentLocus(tracks.default_locus);
        }
      })
      .catch(() => setReportTracks({}))
      .finally(() => setTracksReady(true));
  }, [reportId]);

  useEffect(() => {
    if (!igvContainer.current || isInitializedRef.current || !tracksReady) return;

    let cancelled = false;

    const initIgv = async () => {
      setIsIgvLoading(true);
      setLoadError("");
      if (igvContainer.current) igvContainer.current.innerHTML = "";

      const locus = searchParams.get("locus") || reportTracks?.default_locus || locusParam;
      const tracks: any[] = [
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
      ];
      if (reportTracks?.tumor_bam) {
        tracks.push({
          name: "Tumor report BAM",
          url: reportTracks.tumor_bam,
          indexURL: reportTracks.tumor_bai || undefined,
          format: "bam",
          order: 1,
          color: "#c0392b",
          height: 120,
        });
      }
      if (reportTracks?.normal_bam) {
        tracks.push({
          name: "Normal report BAM",
          url: reportTracks.normal_bam,
          indexURL: reportTracks.normal_bai || undefined,
          format: "bam",
          order: 2,
          color: "#2980b9",
          height: 120,
        });
      }
      if (!reportTracks?.tumor_bam) {
        tracks.push({
          name: "NA12878 chr20 (BAM)",
          url: "https://1000genomes.s3.amazonaws.com/phase3/data/NA12878/alignment/NA12878.chrom20.ILLUMINA.bwa.CEU.low_coverage.20121211.bam",
          indexURL: "https://1000genomes.s3.amazonaws.com/phase3/data/NA12878/alignment/NA12878.chrom20.ILLUMINA.bwa.CEU.low_coverage.20121211.bam.bai",
          format: "bam",
          order: 998,
          color: "#4ecdc4",
        });
      }

      try {
        const browser = await igv.createBrowser(igvContainer.current!, {
          genome: "hg38",
          locus,
          showNavigation: true,
          showRuler: true,
          tracks,
        });
        if (!cancelled) {
          browserRef.current = browser;
          isInitializedRef.current = true;
          setIsIgvLoading(false);
          setCurrentLocus(locus);
          setSearchInput(locus);
        } else {
          try { (igv as any).removeBrowser(browser); } catch (e) { /* ignore */ }
        }
      } catch (err) {
        console.error("IGV 初始化失败:", err);
        if (!cancelled) {
          setIsIgvLoading(false);
          setLoadError("基因组浏览器加载失败，请刷新页面重试");
        }
      }
    };

    initIgv();
    return () => {
      cancelled = true;
      if (browserRef.current) {
        try { (igv as any).removeBrowser(browserRef.current); } catch (e) { /* ignore */ }
        browserRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [tracksReady, reportTracks]);

  useEffect(() => {
    if (browserRef.current && isInitializedRef.current && locusParam) {
      browserRef.current.search(locusParam).catch(console.error);
      setCurrentLocus(locusParam);
      setSearchInput(locusParam);
    }
  }, [locusParam]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || !browserRef.current) return;
    try {
      await browserRef.current.search(searchInput.trim());
      setCurrentLocus(searchInput.trim());
    } catch (err) {
      console.error("搜索失败:", err);
    }
  }, [searchInput]);

  const quickLoci = [
    { label: "TP53", locus: "chr17:7,674,100-7,674,400" },
    { label: "KRAS", locus: "chr12:25,245,250-25,245,450" },
    { label: "BRCA1", locus: "chr17:43,044,295-43,125,364" },
    { label: "EGFR", locus: "chr7:55,019,017-55,211,628" },
  ];

  const handleQuickJump = async (locus: string) => {
    setSearchInput(locus);
    if (browserRef.current) {
      try {
        await browserRef.current.search(locus);
        setCurrentLocus(locus);
      } catch (err) {
        console.error("跳转失败:", err);
      }
    }
  };

  const handleAddCustomBam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!browserRef.current || !bamUrl.trim()) return;
    setAddingTrack(true);
    try {
      if (customTrackRef.current) {
        await browserRef.current.removeTrack(customTrackRef.current);
        customTrackRef.current = null;
      }
      const track = await browserRef.current.loadTrack({
        name: customTrackName || "自定义 BAM",
        url: bamUrl.trim(),
        indexURL: bamIndexUrl.trim() || undefined,
        format: "bam",
        order: 10,
        color: "#9b59b6",
        height: 120,
      });
      customTrackRef.current = track;
    } catch (err) {
      console.error("添加 BAM 失败:", err);
      window.alert("添加 BAM 轨道失败，请检查 URL 与跨域设置");
    } finally {
      setAddingTrack(false);
    }
  };

  return (
    <div className="browser-page">
      <div className="browser-toolbar">
        <div className="browser-toolbar-left">
          <Link to={reportId ? `/reports/${reportId}` : "/dashboard"} className="browser-back">
            <i className="fas fa-arrow-left" /> 返回
          </Link>
          <div>
            <h1>IGV 证据浏览器</h1>
            <p>
              基于 IGV.js · 参考基因组 hg38 · 当前位置: <strong>{currentLocus}</strong>
              {reportTitle ? <> · {reportTitle}</> : null}
              {reportTracks?.tumor_bam ? <> · 已加载 Tumor/Normal 小 BAM</> : null}
            </p>
          </div>
        </div>
        <form className="browser-search" onSubmit={handleSearch}>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="chr17:7,674,100-7,674,400" />
          <button type="submit">定位</button>
        </form>
      </div>

      <div className="browser-quick">
        {quickLoci.map((item) => (
          <button type="button" key={item.label} onClick={() => handleQuickJump(item.locus)}>{item.label}</button>
        ))}
      </div>

      {loadError && <div className="browser-error">{loadError}</div>}
      {isIgvLoading && <div className="browser-loading">正在加载基因组浏览器…</div>}
      <div ref={igvContainer} className="igv-container" />

      <form className="browser-custom-bam" onSubmit={handleAddCustomBam}>
        <h2>添加自定义 BAM</h2>
        <label>轨道名称<input value={customTrackName} onChange={(e) => setCustomTrackName(e.target.value)} /></label>
        <label>BAM URL<input value={bamUrl} onChange={(e) => setBamUrl(e.target.value)} placeholder="/media/wes_bundles/.../tumor.report.bam" /></label>
        <label>BAI URL<input value={bamIndexUrl} onChange={(e) => setBamIndexUrl(e.target.value)} placeholder="/media/wes_bundles/.../tumor.report.bam.bai" /></label>
        <button type="submit" disabled={addingTrack}>{addingTrack ? "添加中…" : "加载轨道"}</button>
      </form>
    </div>
  );
};

export default GenomeBrowser;
