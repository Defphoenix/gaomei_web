import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/client";
import type { BioPost } from "../types";

interface BioCategory { id: number; name: string; slug: string; }
interface BioTag { id: number; name: string; slug: string; }

const BioBlogEditor: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const isEditing = !!slug;
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [category, setCategory] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isPinned, setIsPinned] = useState(false);
  const [categories, setCategories] = useState<BioCategory[]>([]);
  const [tags, setTags] = useState<BioTag[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [existingImage, setExistingImage] = useState("");

  useEffect(() => {
    api.get("/bioblog/categories/").then(r => setCategories(r.data)).catch(() => {});
    api.get("/bioblog/tags/").then(r => setTags(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEditing && slug && categories.length > 0) {
      api.get(`/bioblog/posts/${slug}/`).then(r => {
        const p: BioPost = r.data;
        setTitle(p.title); setPostSlug(p.slug); setSummary(p.summary || "");
        setContent(p.content || ""); setIsPinned(p.is_pinned);
        if (p.featured_image_url) setExistingImage(p.featured_image_url);
        const cat = categories.find(c => c.slug === p.category_slug);
        if (cat) setCategory(cat.id);
        setSelectedTags(p.tags.map(t => t.id));
      }).catch(() => setError("加载失败"));
    }
  }, [slug, isEditing, categories]);

  const genSlug = (t: string) => {
    let s = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!s || s.length < 2) s = "bio-" + Date.now().toString(36);
    return s;
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    const data: Record<string, any> = {
      title, slug: postSlug || genSlug(title), summary,
      content: content || " ", status, is_pinned: isPinned,
    };
    if (category > 0) data.category = category;
    if (selectedTags.length > 0) data.tags = selectedTags;
    if (status === "published") data.published_at = new Date().toISOString();

    try {
      if (imageFile) {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (Array.isArray(v)) v.forEach(x => fd.append(k, String(x)));
          else fd.append(k, String(v));
        });
        fd.append("featured_image", imageFile);
        if (isEditing) await api.put(`/bioblog/posts/${slug}/update/`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        else await api.post("/bioblog/posts/create/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        if (isEditing) await api.put(`/bioblog/posts/${slug}/update/`, data);
        else await api.post("/bioblog/posts/create/", data);
      }
      navigate("/bioblog/manage");
    } catch (err: any) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "保存失败");
    } finally { setLoading(false); }
  };

  return (
    <section style={{ padding: "40px 0", minHeight: "calc(100vh - 56px)", background: "#f8fafc" }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>{isEditing ? "编辑生信文章" : "新建生信文章"}</h3>
          <Link to="/bioblog/manage" className="btn btn-sm btn-outline-dark"><i className="fas fa-arrow-left me-1"></i>返回</Link>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-bold">标题</label>
                <input type="text" className="form-control" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">Slug</label>
                <input type="text" className="form-control" value={postSlug} onChange={e => setPostSlug(e.target.value)} placeholder="留空自动生成" />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">分类</label>
                  <select className="form-select" value={category} onChange={e => setCategory(Number(e.target.value))}>
                    <option value={0}>请选择（可选）</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">置顶</label>
                  <div className="form-check mt-2">
                    <input className="form-check-input" type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} />
                    <label className="form-check-label">置顶文章</label>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">标签</label>
                <div className="d-flex gap-2 flex-wrap">
                  {tags.map(t => (
                    <button key={t.id} type="button" onClick={() => setSelectedTags(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                      className={`btn btn-sm ${selectedTags.includes(t.id) ? "btn-primary" : "btn-outline-secondary"}`}>{t.name}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">封面图</label>
                <div>
                  <input type="file" ref={fileRef} accept="image/*" onChange={handleImage} style={{ display: "none" }} />
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fileRef.current?.click()}><i className="fas fa-upload me-1"></i>上传</button>
                </div>
                {(imagePreview || existingImage) && (
                  <img src={imagePreview || existingImage} alt="" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, marginTop: 8 }} />
                )}
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">摘要</label>
                <textarea className="form-control" rows={2} value={summary} onChange={e => setSummary(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">内容 (支持 $LaTeX$ 和 $$块级公式$$)</label>
                <textarea className="form-control" rows={12} value={content} onChange={e => setContent(e.target.value)}
                  placeholder="## 标题&#10;- 列表&#10;行内公式: $E=mc^2$&#10;块级公式: $$\sum_{i=1}^{n} x_i$$" style={{ fontFamily: "monospace" }} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">状态</label>
                <div className="d-flex gap-3">
                  <div className="form-check"><input className="form-check-input" type="radio" checked={status === "draft"} onChange={() => setStatus("draft")} /><label className="form-check-label">草稿</label></div>
                  <div className="form-check"><input className="form-check-input" type="radio" checked={status === "published"} onChange={() => setStatus("published")} /><label className="form-check-label">发布</label></div>
                </div>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-lg text-white" disabled={loading} style={{ background: "#10b981", border: "none" }}>
              {loading ? "保存中..." : isEditing ? "更新" : "创建"}
            </button>
            <Link to="/bioblog/manage" className="btn btn-lg btn-outline-secondary">取消</Link>
          </div>
        </form>
      </div>
    </section>
  );
};

export default BioBlogEditor;
