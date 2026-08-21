import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import type { BlogPost } from "../types";
import { AnimatedPage, MotionIcon } from "../components/PublicMotion";
import { featuredNewsFallback } from "../components/newsAssets";

const categoryCover: Record<string, { bg: string; icon: string; color: string }> = {
  tech: { bg: "linear-gradient(135deg, #1b5497 0%, #639aff 100%)", icon: "fas fa-code", color: "#1b5497" },
  news: { bg: "linear-gradient(135deg, #c14e00 0%, #e89a61 100%)", icon: "fas fa-newspaper", color: "#c14e00" },
  product: { bg: "linear-gradient(135deg, #639aff 0%, #9fc2ff 100%)", icon: "fas fa-box-open", color: "#639aff" },
  research: { bg: "linear-gradient(135deg, #59832d 0%, #91bd72 100%)", icon: "fas fa-flask", color: "#59832d" },
  default: { bg: "linear-gradient(135deg, #1b5497 0%, #4e58a1 100%)", icon: "fas fa-file-alt", color: "#1b5497" },
};

const categories = [
  { key: "", label: "全部" },
  { key: "tech", label: "技术分享" },
  { key: "news", label: "行业资讯" },
  { key: "product", label: "产品更新" },
  { key: "research", label: "研究进展" },
];

const postLink = (post: BlogPost) => post.wechat_link || `/blog/${post.slug}`;

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([]);
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const category = searchParams.get("category") || "";
  const featured = featuredPosts.slice(0, 3);
  const remaining = posts.filter((post) => !featured.some((item) => item.id === post.id));
  const pageSize = 6;
  const pages = Math.max(1, Math.ceil(remaining.length / pageSize));
  const paginated = useMemo(() => remaining.slice((page - 1) * pageSize, page * pageSize), [page, remaining]);

  useEffect(() => {
    api.get("/blog/latest/").then((res) => setFeaturedPosts(res.data)).catch(() => setFeaturedPosts([]));
  }, []);

  useEffect(() => {
    setPage(1);
    const url = category ? `/blog/posts/?category=${category}` : "/blog/posts/";
    api.get(url).then((res) => setPosts(res.data)).catch(() => setPosts([]));
  }, [category]);

  return (
    <AnimatedPage className="news-public-page">
      <section className="news-showcase-hero">
        <div className="news-hero-grid" />
        <div className="site-container news-showcase-copy motion-hero">
          <MotionIcon variant="network" />
          <span className="eyebrow dark">INSIGHTS & DISCOVERY</span>
          <h1>基因组学知识<br /><b>与前沿资讯</b></h1>
          <p>追踪精准医学、生物信息技术与产业实践，让复杂研究以更清晰的方式被理解。</p>
          <div className="news-topic-cloud"><span>WES</span><span>甲基化</span><span>肿瘤早筛</span><span>生物信息</span><span>精准治疗</span></div>
        </div>
      </section>

      <section className="section section-light featured-news-section">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal">
            <div><span className="eyebrow">FEATURED INSIGHTS</span><h2>精选资讯</h2></div>
            <p>首屏固定展示三篇重点内容，推荐顺序由管理员在资讯管理中控制。</p>
          </div>
          <div className="featured-news-grid motion-stagger">
            {featured.map((post, index) => {
              const external = !!post.wechat_link;
              const coverImage = post.featured_image_url || featuredNewsFallback(index);
              return <a className="featured-news-card" href={postLink(post)} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} key={post.id}>
                <div className="featured-news-image" style={{ background: `url('${coverImage}') center/cover` }}>
                  <span>FEATURE 0{index + 1}</span><div className="featured-scan" />
                </div>
                <div className="featured-news-copy"><small>{post.category_name} · {new Date(post.published_at).toLocaleDateString("zh-CN")}</small><h3>{post.title}</h3><p>{post.summary || "探索生命数据背后的科学价值与应用路径。"}</p><b>{external ? "微信阅读" : "阅读全文"} <i className="fas fa-arrow-right" /></b></div>
              </a>;
            })}
          </div>
          {featured.length === 0 && <div className="news-empty"><MotionIcon variant="report" /><p>当前分类暂无精选内容。</p></div>}
        </div>
      </section>

      <section className="section section-tint news-archive-section">
        <div className="site-container">
          <div className="news-archive-head motion-reveal"><div><span className="eyebrow">KNOWLEDGE ARCHIVE</span><h2>全部内容</h2></div>
            <nav aria-label="资讯分类">{categories.map((item) => <Link className={category === item.key ? "is-active" : ""} key={item.key} to={`/blog${item.key ? `?category=${item.key}` : ""}`}>{item.label}</Link>)}</nav>
          </div>
          <div className="compact-news-list motion-stagger" key={`${category}-${page}`}>
            {paginated.map((post) => {
              const cover = categoryCover[post.category_slug] || categoryCover.default;
              const external = !!post.wechat_link;
              return <a href={postLink(post)} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} key={post.id}>
                <div className="compact-news-icon" style={{ background: cover.bg }}>{post.featured_image_url ? <img src={post.featured_image_url} alt="" /> : <i className={cover.icon} />}</div>
                <div><small>{post.category_name} · {new Date(post.published_at).toLocaleDateString("zh-CN")}</small><h3>{post.title}</h3><p>{post.summary}</p><span>{post.tags.slice(0, 2).map((tag) => <b key={tag.id}>{tag.name}</b>)}</span></div>
                <aside><i className="fas fa-eye" />{post.views}<b className="fas fa-arrow-right" /></aside>
              </a>;
            })}
          </div>
          {remaining.length === 0 && posts.length > 0 && <div className="news-empty compact"><p>当前分类的内容已全部展示在精选区域。</p></div>}
          {remaining.length > pageSize && <div className="news-pagination"><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><i className="fas fa-arrow-left" />上一页</button><span>{page} / {pages}</span><button type="button" disabled={page === pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>下一页<i className="fas fa-arrow-right" /></button></div>}
        </div>
      </section>
    </AnimatedPage>
  );
};

export default BlogList;
