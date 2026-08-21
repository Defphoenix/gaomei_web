import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import type { BioPost, BioComment } from "../types";
import { useAuth } from "../context/AuthContext";
import { MotionIcon } from "../components/PublicMotion";

// Simple LaTeX block renderer
const renderLatex = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return (
        <div key={i} style={{
          background: "rgba(102,126,234,0.04)", borderRadius: 8,
          padding: "16px 20px", margin: "16px 0", textAlign: "center",
          overflowX: "auto", fontFamily: "monospace", fontSize: "0.95rem",
          color: "#333", border: "1px solid rgba(102,126,234,0.1)",
        }}>
          {part.replace(/\$\$/g, "").trim()}
        </div>
      );
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <span key={i} style={{
          background: "rgba(102,126,234,0.06)", borderRadius: 4,
          padding: "1px 6px", fontFamily: "monospace", fontSize: "0.9em",
          color: "#667eea",
        }}>
          {part.replace(/\$/g, "").trim()}
        </span>
      );
    }
    // Regular text - process markdown-like syntax
    const lines = part.split("\n");
    return (
      <span key={i}>
        {lines.map((line, li) => {
          if (line.startsWith("### ")) return <h4 key={li} style={{ marginTop: 20, marginBottom: 8, fontWeight: 700 }}>{line.replace("### ", "")}</h4>;
          if (line.startsWith("## ")) return <h3 key={li} style={{ marginTop: 24, marginBottom: 10, fontWeight: 800 }}>{line.replace("## ", "")}</h3>;
          if (line.startsWith("- ")) return <li key={li} style={{ marginLeft: 20, marginBottom: 4 }}>{renderBold(line.replace("- ", ""))}</li>;
          if (line.trim() === "") return <br key={li} />;
          return <p key={li} style={{ marginBottom: 8, lineHeight: 1.8 }}>{renderBold(line)}</p>;
        })}
      </span>
    );
  });
};

const renderBold = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
};

const BioBlogDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BioPost | null>(null);
  const [comments, setComments] = useState<BioComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<BioComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!slug) return;
    api.get(`/bioblog/posts/${slug}/`).then(r => setPost(r.data)).catch(() => {});
    api.get(`/bioblog/posts/${slug}/comments/`).then(r => setComments(r.data)).catch(() => {});
  }, [slug]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const response = await api.post(`/bioblog/posts/${slug}/comments/`, {
        content: commentText.trim(),
        parent: replyTo?.id || null,
      });
      setComments((items) => [...items, response.data]);
      setCommentText("");
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!post) return <div className="text-center py-5 text-muted">加载中...</div>;

  return (
    <section className="wiki-detail-page">
      {/* Banner */}
      <div className="wiki-detail-hero" style={{
        background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
        padding: "60px 0 50px",
      }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <Link to="/bioblog" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", textDecoration: "none" }}>
            <i className="fas fa-arrow-left me-1"></i>返回知识库
          </Link>
          <div className="wiki-detail-mark"><MotionIcon variant="network" /></div>
          <h1 style={{ color: "#fff", fontWeight: 900, fontSize: "2rem", marginTop: 16, marginBottom: 8 }}>
            {post.title}
          </h1>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
            <i className="fas fa-user me-1"></i>{post.author_name}
            <span className="mx-2">·</span>
            <i className="fas fa-calendar me-1"></i>{new Date(post.published_at).toLocaleDateString("zh-CN")}
            <span className="mx-2">·</span>
            <i className="fas fa-eye me-1"></i>{post.views} 阅读
            {post.category_name && (<><span className="mx-2">·</span>{post.category_name}</>)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-4" style={{ maxWidth: 800 }}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "32px 40px",
          boxShadow: "0 2px 20px rgba(0,0,0,0.06)", lineHeight: 1.8,
          fontSize: "1.02rem", color: "#444",
        }}>
          {post.content && renderLatex(post.content)}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link to="/bioblog" style={{ color: "#667eea", textDecoration: "none", fontSize: "0.9rem" }}>
            <i className="fas fa-arrow-left me-1"></i>返回列表
          </Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {post.tags.map(t => (
              <span key={t.id} style={{ background: "#eee", color: "#888", padding: "3px 10px", borderRadius: 10, fontSize: "0.78rem" }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>

        <section className="wiki-discussion">
          <div className="wiki-discussion-head"><div><span>TEAM DISCUSSION</span><h2>文章讨论</h2><p>{comments.length} 条讨论 · 仅内部成员可见</p></div><MotionIcon variant="cloud" /></div>
          <form onSubmit={submitComment}>
            {replyTo && <div className="replying-to">正在回复 <b>{replyTo.author_name}</b><button type="button" onClick={() => setReplyTo(null)}>取消</button></div>}
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={4} placeholder="分享分析经验、参数建议或提出问题…" aria-label="讨论内容" />
            <div><span><i className="fas fa-user-circle" /> {user?.username}</span><button className="button button-primary" disabled={submitting || !commentText.trim()}>{submitting ? "正在发布…" : "发布讨论"}</button></div>
          </form>
          <div className="wiki-comments">
            {comments.map((comment) => <article className={comment.parent ? "is-reply" : ""} key={comment.id}>
              <div className="comment-avatar">{comment.author_name.slice(0, 1).toUpperCase()}</div>
              <div><div className="comment-meta"><b>{comment.author_name}</b><span>{comment.author_role}</span><small>{new Date(comment.created_at).toLocaleString("zh-CN")}</small></div><p>{comment.content}</p><button type="button" onClick={() => setReplyTo(comment)}><i className="fas fa-reply" /> 回复</button></div>
            </article>)}
            {comments.length === 0 && <div className="wiki-no-comments">还没有讨论，欢迎留下第一条技术意见。</div>}
          </div>
        </section>
      </div>
    </section>
  );
};

export default BioBlogDetail;
