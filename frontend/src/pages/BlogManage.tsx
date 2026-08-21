import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { BlogPost } from "../types";

const BlogManage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [updatingHomepage, setUpdatingHomepage] = useState<string | null>(null);

  // Only admin can access
  useEffect(() => {
    if (user && !user.is_staff) {
      navigate("/blog");
    }
  }, [user, navigate]);

  const fetchPosts = () => {
    setLoading(true);
    // Fetch all posts including drafts via a special endpoint
    api.get("/blog/posts/?include_drafts=true")
      .then((res) => setPosts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDelete = async (slug: string) => {
    try {
      await api.delete(`/blog/posts/${slug}/delete/`);
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
      setDeleteConfirm(null);
    } catch {
      alert("删除失败");
    }
  };

  const toggleHomepage = async (post: BlogPost) => {
    setUpdatingHomepage(post.slug);
    try {
      const next = !post.show_on_homepage;
      if (next && posts.filter((item) => item.show_on_homepage && item.status === "published").length >= 3) {
        alert("首页最多推荐 3 篇资讯，请先取消一篇现有推荐");
        return;
      }
      await api.patch(`/blog/posts/${post.slug}/update/`, { show_on_homepage: next });
      setPosts((items) => items.map((item) => item.slug === post.slug ? { ...item, show_on_homepage: next } : item));
    } catch {
      alert("首页展示设置更新失败");
    } finally {
      setUpdatingHomepage(null);
    }
  };

  const togglePublished = async (post: BlogPost) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    try {
      await api.patch(`/blog/posts/${post.slug}/update/`, {
        status: nextStatus,
        show_on_homepage: nextStatus === "published" ? post.show_on_homepage : false,
        ...(nextStatus === "published" ? { published_at: new Date().toISOString() } : {}),
      });
      setPosts((items) => items.map((item) => item.slug === post.slug ? {
        ...item,
        status: nextStatus,
        show_on_homepage: nextStatus === "published" ? item.show_on_homepage : false,
      } : item));
    } catch {
      alert("文章显示状态更新失败");
    }
  };

  const updateHomepageOrder = async (post: BlogPost, order: number) => {
    try {
      await api.patch(`/blog/posts/${post.slug}/update/`, { homepage_order: order });
      setPosts((items) => items.map((item) => item.slug === post.slug ? { ...item, homepage_order: order } : item));
    } catch {
      alert("首页排序更新失败");
    }
  };

  return (
    <section style={{ padding: "40px 0", minHeight: "calc(100vh - 56px)", background: "#f8f9fa" }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">博客管理</h3>
          <div className="d-flex gap-2">
            <Link to="/blog" className="btn btn-sm btn-outline-dark">
              <i className="fas fa-eye me-1"></i>查看前台
            </Link>
            <Link to="/blog/editor" className="btn btn-sm text-white"
              style={{ background: "#667eea", border: "none" }}>
              <i className="fas fa-plus me-1"></i>新建文章
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-5">加载中...</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-file-alt fa-3x text-muted mb-3"></i>
            <p className="text-muted">暂无文章</p>
            <Link to="/blog/editor" className="btn text-white"
              style={{ background: "#667eea", border: "none" }}>
              创建第一篇文章
            </Link>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>标题</th>
                    <th>分类</th>
                    <th>状态</th>
                    <th>首页展示</th>
                    <th>首页顺序</th>
                    <th>前台状态</th>
                    <th>阅读</th>
                    <th>发布时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.slug}>
                      <td>
                        <strong>{post.title}</strong>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark">{post.category_name}</span>
                      </td>
                      <td>
                        <span className={`badge ${post.status === "published" ? "bg-success" : "bg-secondary"}`}>
                          {post.status === "published" ? "已发布" : "草稿"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleHomepage(post)}
                          disabled={updatingHomepage === post.slug || post.status !== "published"}
                          className={`btn btn-sm ${post.show_on_homepage ? "btn-primary" : "btn-outline-secondary"}`}
                          title={post.status !== "published" ? "草稿不能在首页展示" : "切换首页推荐状态"}
                        >
                          <i className={`fas ${post.show_on_homepage ? "fa-star" : "fa-star-half-alt"} me-1`} />
                          {post.show_on_homepage ? "推荐中" : "不展示"}
                        </button>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={post.homepage_order || 0}
                          disabled={!post.show_on_homepage}
                          onChange={(e) => setPosts((items) => items.map((item) => item.slug === post.slug ? { ...item, homepage_order: Number(e.target.value) } : item))}
                          onBlur={(e) => updateHomepageOrder(post, Number(e.target.value))}
                          className="form-control form-control-sm"
                          style={{ width: 72 }}
                          aria-label={`${post.title} 首页排序`}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => togglePublished(post)} className={`btn btn-sm ${post.status === "published" ? "btn-outline-warning" : "btn-outline-success"}`}>
                          <i className={`fas ${post.status === "published" ? "fa-eye-slash" : "fa-eye"} me-1`} />
                          {post.status === "published" ? "隐藏" : "发布"}
                        </button>
                      </td>
                      <td>{post.views}</td>
                      <td className="small text-muted">
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString("zh-CN")
                          : "-"}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link to={`/blog/editor/${post.slug}`}
                            className="btn btn-sm btn-outline-primary" title="编辑">
                            <i className="fas fa-edit"></i>
                          </Link>
                          {deleteConfirm === post.slug ? (
                            <div className="d-flex gap-1">
                              <button onClick={() => handleDelete(post.slug)}
                                className="btn btn-sm btn-danger" title="确认删除">
                                确认
                              </button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="btn btn-sm btn-outline-secondary" title="取消">
                                取消
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(post.slug)}
                              className="btn btn-sm btn-outline-danger" title="删除">
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BlogManage;
