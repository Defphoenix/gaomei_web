import React, { useRef, useEffect, useState, useCallback } from "react";
import igv from "igv";
import { useSearchParams, Link } from "react-router-dom";

const GenomeBrowser: React.FC = () => {
  const igvContainer = useRef<HTMLDivElement>(null);
  const browserRef = useRef<igv.Browser | null>(null);
  const isInitializedRef = useRef(false);
  const customTrackRef = useRef<any>(null);
  const [searchParams] = useSearchParams();
  const locusParam = searchParams.get("locus") || "chr20:71,072-71,133";

  const [searchInput, setSearchInput] = useState(locusParam);
  const [currentLocus, setCurrentLocus] = useState(locusParam);
  const [isIgvLoading, setIsIgvLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bamUrl, setBamUrl] = useState("");
  const [bamIndexUrl, setBamIndexUrl] = useState("");
  const [customTrackName, setCustomTrackName] = useState("自定义 BAM");
  const [addingTrack, setAddingTrack] = useState(false);

  // Initialize IGV - runs only once
  useEffect(() => {
    if (!igvContainer.current || isInitializedRef.current) return;

    let cancelled = false;

    const initIgv = async () => {
      setIsIgvLoading(true);
      setLoadError("");

      // Clear container to prevent double instances
      if (igvContainer.current) {
        igvContainer.current.innerHTML = "";
      }

      try {
        const browser = await igv.createBrowser(igvContainer.current!, {
          genome: "hg38",
          locus: locusParam,
          showNavigation: true,
          showRuler: true,
          tracks: [
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
            {
              name: "NA12878 chr20 (BAM)",
              url: "https://1000genomes.s3.amazonaws.com/phase3/data/NA12878/alignment/NA12878.chrom20.ILLUMINA.bwa.CEU.low_coverage.20121211.bam",
              indexURL: "https://1000genomes.s3.amazonaws.com/phase3/data/NA12878/alignment/NA12878.chrom20.ILLUMINA.bwa.CEU.low_coverage.20121211.bam.bai",
              format: "bam",
              order: 998,
              color: "#4ecdc4",
            },
          ],
        });

        if (!cancelled) {
          browserRef.current = browser;
          isInitializedRef.current = true;
          setIsIgvLoading(false);
        } else {
          try { (igv as any).removeBrowser(browser); } catch(e) {}
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
        try { (igv as any).removeBrowser(browserRef.current); } catch(e) {}
        browserRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []); // Empty deps - only initialize once

  // Handle locus changes from URL params
  useEffect(() => {
    if (browserRef.current && isInitializedRef.current && locusParam) {
      browserRef.current.search(locusParam).catch(console.error);
      setCurrentLocus(locusParam);
      setSearchInput(locusParam);
    }
  }, [locusParam]);

  // Search handler
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

  // Quick jump to variant genes
  const quickLoci = [
    { label: "MYC", locus: "chr8:127,736,588-127,739,371", desc: "3个变异位点" },
    { label: "TP53", locus: "chr17:7,668,421-7,687,490", desc: "2个变异位点" },
    { label: "BRCA1", locus: "chr17:43,044,295-43,125,364", desc: "1个变异位点" },
    { label: "EGFR", locus: "chr7:55,019,017-55,211,628", desc: "2个变异位点" },
    { label: "MLH1", locus: "chr3:37,034,000-37,093,000", desc: "MSI相关基因" },
  ];

  const handleQuickJump = useCallback(async (locus: string, label: string) => {
    if (!browserRef.current) return;
    try {
      await browserRef.current.search(locus);
      setCurrentLocus(locus);
      setSearchInput(locus);
    } catch (err) {
      console.error("跳转失败:", err);
    }
  }, []);

  // Add custom BAM track
  const handleAddBamTrack = useCallback(async () => {
    if (!browserRef.current || !bamUrl.trim()) return;
    setAddingTrack(true);
    try {
      // Remove existing custom track if any
      if (customTrackRef.current) {
        (browserRef.current as any).removeTrack(customTrackRef.current);
      }
      const trackConfig: any = {
        name: customTrackName || "自定义 BAM",
        url: bamUrl.trim(),
        format: "bam",
        order: 100,
        color: "#4ecdc4",
      };
      if (bamIndexUrl.trim()) {
        trackConfig.indexURL = bamIndexUrl.trim();
      }
      const track = await browserRef.current.loadTrack(trackConfig);
      customTrackRef.current = track;
    } catch (err) {
      console.error("BAM 加载失败:", err);
      alert("BAM 文件加载失败，请检查URL是否正确");
    } finally {
      setAddingTrack(false);
    }
  }, [bamUrl, bamIndexUrl, customTrackName]);

  return (
    <section style={{ padding: "20px 0", minHeight: "calc(100vh - 56px)", backgroundColor: "#f8f9fa" }}>
      <div className="container-fluid" style={{ maxWidth: 1400 }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="mb-1">
              <i className="fas fa-dna me-2" style={{ color: "#667eea" }}></i>
              本地基因组浏览器
            </h4>
            <small className="text-muted">
              基于 IGV.js · 参考基因组 hg38 · 当前位置: <strong>{currentLocus}</strong>
            </small>
          </div>
          <div className="d-flex gap-2">
            <Link to="/dashboard" className="btn btn-sm btn-outline-dark">
              <i className="fas fa-arrow-left me-1"></i>返回报告
            </Link>
          </div>
        </div>

        {/* Quick Gene Navigation */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
              <small className="fw-bold text-muted me-2">快速定位变异位点:</small>
              {quickLoci.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleQuickJump(q.locus, q.label)}
                  className="btn btn-sm btn-outline-primary"
                  title={`${q.desc} - ${q.locus}`}
                >
                  <i className="fas fa-map-marker-alt me-1"></i>{q.label}
                  <small className="ms-1 opacity-75">({q.desc})</small>
                </button>
              ))}
            </div>
            <form onSubmit={handleSearch} className="d-flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="输入基因名或基因座，如 MYC、chr8:127736588"
                className="form-control form-control-sm"
                style={{ maxWidth: 450 }}
              />
              <button type="submit" className="btn btn-sm text-white"
                style={{ background: "#667eea", border: "none" }}>
                <i className="fas fa-search me-1"></i>搜索
              </button>
            </form>
          </div>
        </div>

        {/* IGV Browser Container */}
        <div className="card border-0 shadow-sm" style={{ position: "relative" }}>
          {isIgvLoading && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(255,255,255,0.9)", zIndex: 10,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div className="spinner-border mb-3" style={{ width: "3rem", height: "3rem", color: "#667eea" }} role="status"></div>
              <p className="text-muted mb-1">正在加载基因组浏览器...</p>
              <small className="text-muted">首次加载需要下载参考基因组数据，请耐心等待</small>
            </div>
          )}
          {loadError && (
            <div className="alert alert-warning m-3" role="alert">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {loadError}
              <button className="btn btn-sm btn-warning ms-2" onClick={() => window.location.reload()}>
                刷新页面
              </button>
            </div>
          )}
          <div ref={igvContainer} style={{ width: "100%", minHeight: "550px" }} />
        </div>

        {/* Custom BAM URL Input */}
        <div className="card border-0 shadow-sm mt-3">
          <div className="card-body">
            <h6 className="mb-3"><i className="fas fa-cloud-upload-alt me-2"></i>加载自定义 BAM 文件</h6>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small fw-bold">Track 名称</label>
                <input type="text" className="form-control form-control-sm" value={customTrackName}
                  onChange={(e) => setCustomTrackName(e.target.value)} placeholder="自定义 BAM" />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-bold">BAM 文件 URL *</label>
                <input type="text" className="form-control form-control-sm" value={bamUrl}
                  onChange={(e) => setBamUrl(e.target.value)}
                  placeholder="http://your-nginx-server/sample.bam" />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-bold">BAM Index URL (可选)</label>
                <input type="text" className="form-control form-control-sm" value={bamIndexUrl}
                  onChange={(e) => setBamIndexUrl(e.target.value)}
                  placeholder="http://your-nginx-server/sample.bam.bai" />
              </div>
              <div className="col-md-2">
                <button className="btn btn-sm text-white w-100" disabled={addingTrack || !bamUrl.trim()}
                  onClick={handleAddBamTrack}
                  style={{ background: "#4ecdc4", border: "none" }}>
                  {addingTrack ? "加载中..." : "加载 BAM"}
                </button>
              </div>
            </div>
            <small className="text-muted mt-2 d-block">
              <i className="fas fa-info-circle me-1"></i>
              输入 BAM 文件 URL（以及可选的 .bai 索引），即可在浏览器中查看比对数据。适用于通过 Nginx/Apache 本地文件服务器托管 BAM 文件。
            </small>
          </div>
        </div>

        {/* Track Legend */}
        <div className="card border-0 shadow-sm mt-3">
          <div className="card-body">
            <h6 className="mb-3"><i className="fas fa-layer-group me-2"></i>当前加载的数据 Track</h6>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="d-flex align-items-start">
                  <span className="badge me-2" style={{ background: "#e74c3c", minWidth: 40 }}>VCF</span>
                  <div>
                    <strong>本地变异位点</strong>
                    <br /><small className="text-muted">8个演示变异: MYC(3), TP53(2), BRCA1(1), EGFR(2)</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-start">
                  <span className="badge bg-primary me-2" style={{ minWidth: 40 }}>BED</span>
                  <div>
                    <strong>基因区域注释</strong>
                    <br /><small className="text-muted">MYC, TP53, BRCA1, EGFR, MLH1 基因坐标</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-start">
                  <span className="badge bg-warning me-2" style={{ minWidth: 40 }}>BAM</span>
                  <div>
                    <strong>NA12878 chr20</strong>
                    <br /><small className="text-muted">1000 Genomes · 20号染色体 Illumina BWA 比对</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Tips */}
        <div className="card border-0 shadow-sm mt-3">
          <div className="card-body">
            <h6 className="mb-2"><i className="fas fa-lightbulb me-2 text-warning"></i>使用提示</h6>
            <ul className="mb-0 small text-muted">
              <li>点击上方基因按钮可快速跳转到对应变异位点</li>
              <li>在搜索框输入基因名（如 <code>MYC</code>）或坐标（如 <code>chr8:127736588</code>）进行搜索</li>
              <li>使用浏览器上方的导航按钮可以缩放、平移查看区域</li>
              <li>点击 VCF track 上的变异位点可查看详细信息</li>
              <li>从报告详情页点击「IGV 查看」按钮会自动跳转到对应位点</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GenomeBrowser;
