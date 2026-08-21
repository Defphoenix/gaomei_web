import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { BioPost } from "../types";

const BioBlogManage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BioPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (user && !["admin", "analyst"].includes(user.role)) navigate("/bioblog");
  }, [user, navigate]);

  const fetchPosts = () => {
    setLoading(true);
    api.get("/bioblog/posts/?include_drafts=true").then(r => setPosts(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = async (slug: string) => {
    try {
      await api.delete(`/bioblog/posts/${slug}/delete/`);
      setPosts(p => p.filter(x => x.slug !== slug));
      setDeleteConfirm(null);
    } catch { alert("删除失败"); }
  };

  return (
    <section style={{ padding: "40px 0", minHeight: "calc(100vh - 56px)", background: "#f8fafc" }}>
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">生信博客管理</h3>
          <div className="d-flex gap-2">
            <Link to="/bioblog" className="btn btn-sm btn-outline-dark"><i className="fas fa-eye me-1"></i>查看前台</Link>
            <Link to="/bioblog/editor" className="btn btn-sm text-white" style={{ background: "#10b981", border: "none" }}>
              <i className="fas fa-plus me-1"></i>新建文章
            </Link>
          </div>
        </div>

        {loading ? <p className="text-center py-5">加载中...</p> : posts.length === 0 ? (
          <div className="text-center py-5"><p className="text-muted">暂无文章</p>
            <Link to="/bioblog/editor" className="btn text-white" style={{ background: "#10b981" }}>创建第一篇文章</Link>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr><th>标题</th><th>分类</th><th>状态</th><th>阅读</th><th>发布时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr key={post.slug}>
                      <td><strong>{post.title}</strong>{post.is_pinned && <span className="badge bg-warning ms-2">置顶</span>}</td>
                      <td><span className="badge bg-light text-dark">{post.category_name || "-"}</span></td>
                      <td><span className={`badge ${post.status === "published" ? "bg-success" : "bg-secondary"}`}>{post.status === "published" ? "已发布" : "草稿"}</span></td>
                      <td>{post.views}</td>
                      <td className="small text-muted">{post.published_at ? new Date(post.published_at).toLocaleDateString("zh-CN") : "-"}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link to={`/bioblog/editor/${post.slug}`} className="btn btn-sm btn-outline-primary"><i className="fas fa-edit"></i></Link>
                          {deleteConfirm === post.slug ? (
                            <div className="d-flex gap-1">
                              <button onClick={() => handleDelete(post.slug)} className="btn btn-sm btn-danger">确认</button>
                              <button onClick={() => setDeleteConfirm(null)} className="btn btn-sm btn-outline-secondary">取消</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(post.slug)} className="btn btn-sm btn-outline-danger"><i className="fas fa-trash"></i></button>
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

export default BioBlogManage;
