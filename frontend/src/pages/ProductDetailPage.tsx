import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PRODUCTS, formatPrice, getProduct } from "../content/productsCatalog";
import {
  getProductCompareTable,
  getProductManual,
  hasProductGuideAccess,
  type CompareCell,
} from "../content/productsManuals";
import "./product-detail.css";

function renderCompareCell(cell: CompareCell) {
  if (typeof cell === "string") return cell;
  if (cell.kind === "yes") return <i className="fas fa-check pd-cmp-yes" aria-label="支持" />;
  if (cell.kind === "no") return <i className="fas fa-times pd-cmp-no" aria-label="不支持" />;
  return cell.text || "—";
}

const ProductDetailPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const known = PRODUCTS.some((p) => p.slug === slug);
  const product = getProduct(slug);
  const manual = useMemo(() => getProductManual(slug), [slug]);
  const compare = useMemo(() => getProductCompareTable(slug), [slug]);
  const [allowed, setAllowed] = useState(() => hasProductGuideAccess(slug));
  const [qrOpen, setQrOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    setAllowed(hasProductGuideAccess(slug));
  }, [slug]);

  useEffect(() => {
    if (!allowed) return;
    if (location.hash === "#report-sample") {
      const el = document.getElementById("report-sample");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [allowed, location.hash, slug]);

  if (!known || !manual) {
    return <Navigate to="/products" replace />;
  }

  if (!allowed) {
    return (
      <div className="pd-gate">
        <div className="pd-gate-card">
          <span>PRODUCT GUIDE</span>
          <h1>请从产品方案页进入</h1>
          <p>
            「{product.title}」详情页仅可通过产品方案中的「查看页面详情」打开，
            不会出现在主导航或其他入口。
          </p>
          <Link className="pd-btn primary" to={`/products/${slug}`}>
            返回产品方案
          </Link>
        </div>
      </div>
    );
  }

  const isFree = product.price <= 0;

  return (
    <div className="pd-page" style={{ ["--pd-accent" as string]: product.accent }}>
      <header className="pd-topbar">
        <button type="button" className="pd-back" onClick={() => navigate(`/products/${slug}`)}>
          <i className="fas fa-arrow-left" /> 返回产品方案
        </button>
        <div className="pd-topbar-title">
          <small>产品详情 · 说明书视图</small>
          <strong>{product.title}</strong>
        </div>
        <button type="button" className="pd-btn ghost" onClick={() => setQrOpen(true)}>
          扫码下单
        </button>
      </header>

      <section className="pd-hero">
        <div className="pd-hero-copy">
          <div className="pd-tags">
            {product.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <h1>{product.title}</h1>
          <p className="pd-sub">{product.subtitle}</p>
          <p className="pd-intro">{product.intro}</p>
          <div className={`pd-price ${isFree ? "is-free" : ""}`}>
            <em>{isFree ? "公益价格" : "参考价格"}</em>
            <strong>{formatPrice(product.price)}</strong>
            {!!product.priceOriginal && product.priceOriginal > product.price && (
              <s>原价 {formatPrice(product.priceOriginal)}</s>
            )}
            {product.priceNote && <span>{product.priceNote}</span>}
          </div>
          <div className="pd-hero-actions">
            <button type="button" className="pd-btn primary" onClick={() => setSampleOpen(true)}>
              查看报告示例
            </button>
            <button type="button" className="pd-btn secondary" onClick={() => setQrOpen(true)}>
              扫码下单
            </button>
          </div>
        </div>
        <div className="pd-hero-visual">
          <img src={product.image} alt={product.title} />
        </div>
      </section>

      <section className="pd-meta-strip">
        <article>
          <span>适用场景</span>
          <strong>{product.scene}</strong>
        </article>
        <article>
          <span>样本要求</span>
          <strong>{product.sample}</strong>
        </article>
        <article>
          <span>交付产出</span>
          <strong>{product.output}</strong>
        </article>
      </section>

      <section className="pd-manual" id="manual">
        <header>
          <span>PRODUCT MANUAL</span>
          <h2>产品说明书摘要</h2>
          <p>{manual.disclaimer}</p>
        </header>
        <div className="pd-manual-list">
          {manual.sections.map((section, index) => (
            <article key={`${section.heading}-${index}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <h3>{section.heading}</h3>
                {section.paragraphs.map((p) => <p key={p.slice(0, 48)}>{p}</p>)}
                {section.bullets && section.bullets.length > 0 && (
                  <ul>
                    {section.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pd-journey" id="journey">
        <header>
          <span>WHY THIS PRODUCT</span>
          <h2>{manual.journey.title}</h2>
          <p>{manual.journey.subtitle}</p>
        </header>
        <ol className="pd-journey-grid">
          {manual.journey.steps.map((s, idx) => (
            <li key={s.id} className="pd-journey-card">
              <div className="pd-journey-icon" aria-hidden="true">
                <i className={`fas ${s.icon}`} />
              </div>
              <span className="pd-journey-label">{s.label}</span>
              <p>
                {s.parts.map((part, i) => (
                  <span key={`${s.id}-${i}`} className={part.accent ? "accent" : undefined}>
                    {part.text}
                  </span>
                ))}
              </p>
              {idx < manual.journey.steps.length - 1 && (
                <span className="pd-journey-dotpath" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="pd-sample-block" id="report-sample">
        <header>
          <span>REPORT SAMPLE</span>
          <h2>报告内容</h2>
          <p>{manual.reportSample.summary}</p>
        </header>

        <div className="pd-module-grid">
          {manual.reportSample.modules.map((mod) => (
            <button
              type="button"
              key={mod.id}
              className="pd-module-card"
              style={{ ["--mod-color" as string]: mod.color }}
              onClick={() => {
                setActiveModule(mod.id);
                setSampleOpen(true);
              }}
            >
              <div className="pd-module-top">
                <i className={`fas ${mod.icon}`} aria-hidden="true" />
                <strong>{mod.title}</strong>
              </div>
              <p>{mod.desc}</p>
              <span className="pd-module-foot">
                查看 {mod.count} {mod.countLabel || "项检测"}
              </span>
            </button>
          ))}
        </div>
        <p className="pd-module-note">* 具体项目数量以实际检测为准</p>

        <div className="pd-sample-card">
          <div>
            <h3>{manual.reportSample.title}</h3>
            <ol>
              {manual.reportSample.sections.map((item) => <li key={item}>{item}</li>)}
            </ol>
            <small>{manual.reportSample.note}</small>
          </div>
          <button type="button" className="pd-btn primary" onClick={() => { setActiveModule(null); setSampleOpen(true); }}>
            展开示例预览
          </button>
        </div>
      </section>

      <section className="pd-compare" id="compare">
        <header>
          <span>PRODUCT COMPARE</span>
          <h2>{compare.title}</h2>
          <p>{compare.subtitle}</p>
        </header>
        <div className="pd-compare-scroll">
          <table className="pd-compare-table">
            <thead>
              <tr>
                <th scope="col">对比项目</th>
                {compare.columns.map((col) => (
                  <th
                    key={col.slug}
                    scope="col"
                    className={col.slug === slug ? "is-active" : undefined}
                    style={{ ["--cmp-accent" as string]: col.accent }}
                  >
                    {col.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  {compare.columns.map((col) => (
                    <td
                      key={`${r.key}-${col.slug}`}
                      className={col.slug === slug ? "is-active" : undefined}
                    >
                      {renderCompareCell(r.cells[col.slug] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pd-compare-note">{compare.footnote}</p>
      </section>

      <section className="pd-order" id="order">
        <div>
          <span>ORDER</span>
          <h2>扫码下单</h2>
          <p>{product.qrLabel}。顾问将根据样本类型与适用人群协助完成下单与采样安排。</p>
        </div>
        <button type="button" className="pd-btn primary" onClick={() => setQrOpen(true)}>
          打开下单二维码
        </button>
      </section>

      {sampleOpen && (
        <div className="pd-modal" role="dialog" aria-modal="true" onClick={() => setSampleOpen(false)}>
          <div className="pd-modal-card pd-sample-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="pd-modal-close" aria-label="关闭" onClick={() => setSampleOpen(false)}>
              <i className="fas fa-times" />
            </button>
            <small>示例报告结构</small>
            <h3>{product.title}</h3>
            {activeModule && (
              <p className="pd-active-mod">
                当前模块：
                {manual.reportSample.modules.find((x) => x.id === activeModule)?.title || activeModule}
              </p>
            )}
            <div className="pd-sample-pages">
              {manual.reportSample.sections.map((item, i) => (
                <article key={item}>
                  <em>P{i + 1}</em>
                  <strong>{item}</strong>
                  <p>
                    {i === 0 && "受检编号、采样日期、项目名称与签发信息。"}
                    {i === 1 && "风险分层结论与一句话行动建议（示例文案）。"}
                    {i === 2 && "关键信号摘要、证据等级与参考文献占位。"}
                    {i === 3 && "采血量、提取浓度、文库与测序质控通过标记。"}
                    {i === 4 && "随访周期、影像/专科转诊提示（需医生综合判断）。"}
                    {i === 5 && "方法学简述、适用边界与免责声明。"}
                  </p>
                </article>
              ))}
            </div>
            <p className="pd-sample-note">{manual.reportSample.note}</p>
          </div>
        </div>
      )}

      {qrOpen && (
        <div className="pd-modal" role="dialog" aria-modal="true" onClick={() => setQrOpen(false)}>
          <div className="pd-modal-card pd-qr-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="pd-modal-close" aria-label="关闭" onClick={() => setQrOpen(false)}>
              <i className="fas fa-times" />
            </button>
            <img src={product.qr} alt={product.qrLabel} />
            <strong>{product.title}</strong>
            <p>{product.qrLabel}</p>
            <span>微信扫一扫即可咨询或下单</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
