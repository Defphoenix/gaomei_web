import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import type { BioPost, BioCategory } from "../types";
import { useAuth } from "../context/AuthContext";
import { MotionIcon } from "../components/PublicMotion";

const BioBlogList: React.FC = () => {
  const [posts, setPosts] = useState<BioPost[]>([]);
  const [categories, setCategories] = useState<BioCategory[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "";
  const [query, setQuery] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    api.get("/bioblog/categories/").then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const url = activeCategory ? `/bioblog/posts/?category=${activeCategory}` : "/bioblog/posts/";
    api.get(url).then(r => setPosts(r.data)).catch(() => {});
  }, [activeCategory]);

  return (
    <section className="wiki-list-page">
      {/* Header bar */}
      <div className="wiki-list-hero" style={{
        background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
        padding: "50px 0 40px", textAlign: "center",
      }}>
        <MotionIcon variant="network" />
        <h1 style={{ color: "#fff", fontWeight: 800, fontSize: "2.2rem", marginBottom: 4 }}>
          生信知识库 Wiki
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem" }}>
          生物信息学 · 基因组学 · 计算生物学 知识分享
        </p>
      </div>

      <div className="container py-4">
        <div className="wiki-toolbar">
          <label><i className="fas fa-search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索技术文章、流程或参数…" /></label>
          {["admin", "analyst"].includes(user?.role || "") && <div><Link to="/bioblog/editor" className="button button-primary"><i className="fas fa-plus" />新建 Wiki</Link><Link to="/bioblog/manage" className="button button-outline">管理内容</Link></div>}
        </div>
        <div className="row">
          {/* Sidebar */}
          <div className="col-lg-3 mb-4">
            <div style={{
              background: "#fff", borderRadius: 16, padding: 24,
              boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
              position: "sticky", top: 90,
            }}>
              <h6 style={{ fontWeight: 700, marginBottom: 16, color: "#333" }}>
                <i className="fas fa-th-list me-2"></i>分类导航
              </h6>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  onClick={() => setSearchParams({})}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10, border: "none",
                    background: !activeCategory ? "rgba(102,126,234,0.08)" : "transparent",
                    color: !activeCategory ? "#667eea" : "#555",
                    fontWeight: !activeCategory ? 700 : 500, cursor: "pointer",
                    fontSize: "0.9rem", width: "100%", textAlign: "left",
                    transition: "all 0.2s",
                  }}>
                  <i className="fas fa-globe" style={{ width: 20 }}></i>全部
                  <span style={{ marginLeft: "auto", fontSize: "0.8rem", opacity: 0.5 }}>
                    {categories.reduce((sum, c) => sum + c.post_count, 0)}
                  </span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.slug}
                    onClick={() => setSearchParams({ category: cat.slug })}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 10, border: "none",
                      background: activeCategory === cat.slug ? `rgba(${parseInt(cat.color.slice(1,3),16)},${parseInt(cat.color.slice(3,5),16)},${parseInt(cat.color.slice(5,7),16)},0.08)` : "transparent",
                      color: activeCategory === cat.slug ? cat.color : "#555",
                      fontWeight: activeCategory === cat.slug ? 700 : 500,
                      cursor: "pointer", fontSize: "0.9rem", width: "100%",
                      textAlign: "left", transition: "all 0.2s",
                    }}>
                    <i className={cat.icon} style={{ width: 20, color: activeCategory === cat.slug ? cat.color : "#999" }}></i>
                    {cat.name}
                    <span style={{ marginLeft: "auto", fontSize: "0.8rem", opacity: 0.5 }}>{cat.post_count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="col-lg-9">
            <div className="row g-4">
              {posts.filter((post) => `${post.title}${post.summary}${post.tags.map((tag) => tag.name).join("")}`.toLowerCase().includes(query.toLowerCase())).map(post => (
                <div className="col-md-6" key={post.id}>
                  <Link to={`/bioblog/${post.slug}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "#fff", borderRadius: 16, overflow: "hidden",
                      border: "1px solid #f0f0f0", transition: "all 0.3s",
                      height: "100%",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                      <div style={{
                        height: 140,
                        background: post.featured_image_url
                          ? `url(${post.featured_image_url}) center/cover`
                          : "linear-gradient(135deg, #667eea, #764ba2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {!post.featured_image_url && (
                          <i className="fas fa-dna" style={{ fontSize: "2.5rem", color: "rgba(255,255,255,0.2)" }}></i>
                        )}
                      </div>
                      <div style={{ padding: 18 }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span style={{ fontSize: "0.75rem", color: "#667eea", fontWeight: 600 }}>
                            {post.category_name}
                          </span>
                          <small style={{ color: "#bbb" }}>
                            {new Date(post.published_at).toLocaleDateString("zh-CN")}
                          </small>
                        </div>
                        <h6 style={{ fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>
                          {post.is_pinned && <i className="fas fa-thumbtack me-1" style={{ color: "#f59e0b" }}></i>}
                          {post.title}
                        </h6>
                        <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 0, lineHeight: 1.5 }}>
                          {post.summary?.substring(0, 80)}{post.summary?.length > 80 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            {posts.length === 0 && (
              <div className="text-center py-5 text-muted">
                <i className="fas fa-inbox fa-3x mb-3"></i><p>暂无文章</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BioBlogList;
