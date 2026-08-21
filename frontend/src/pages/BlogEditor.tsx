import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/client";
import type { BlogPost } from "../types";

interface Category {
  id: number; name: string; slug: string;
}
interface Tag {
  id: number; name: string; slug: string;
}

const BlogEditor: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const isEditing = !!slug;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [category, setCategory] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [wechatLink, setWechatLink] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [existingImage, setExistingImage] = useState<string>("");

  useEffect(() => {
    api.get("/blog/categories/").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/blog/tags/").then((res) => setTags(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEditing && slug && categories.length > 0) {
      api.get(`/blog/posts/${slug}/`).then((res) => {
        const post: BlogPost = res.data;
        setTitle(post.title);
        setPostSlug(post.slug);
        setSummary(post.summary || "");
        setContent(post.content || "");
        setWechatLink(post.wechat_link || "");
        if (post.featured_image_url) setExistingImage(post.featured_image_url);
        const cat = categories.find((c) => c.slug === post.category_slug);
        if (cat) setCategory(cat.id);
        setSelectedTags(post.tags.map((t) => t.id));
      }).catch(() => setError("加载文章失败"));
    }
  }, [slug, isEditing, categories]);

  const generateSlug = (text: string) => {
    // Try to extract English/alphanumeric parts first
    let s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // If empty (Chinese-only title), generate a timestamp-based slug
    if (!s || s.length < 2) {
      s = "post-" + Date.now().toString(36);
    }
    return s;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Build post data - skip category if not selected (0)
      const buildPostData = () => {
        const data: Record<string, any> = {
          title,
          slug: postSlug || generateSlug(title),
          summary,
          content: content || " ", // Non-empty required field
          wechat_link: wechatLink || "",
          status,
        };
        // Only include category if selected
        if (category && category > 0) {
          data.category = category;
        }
        // Only include tags if selected
        if (selectedTags.length > 0) {
          data.tags = selectedTags;
        }
        if (status === "published") {
          data.published_at = new Date().toISOString();
        }
        return data;
      };

      if (imageFile) {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("slug", postSlug || generateSlug(title));
        if (category && category > 0) formData.append("category", String(category));
        selectedTags.forEach((t) => formData.append("tags", String(t)));
        formData.append("summary", summary);
        formData.append("content", content || " ");
        formData.append("wechat_link", wechatLink || "");
        formData.append("status", status);
        if (status === "published") formData.append("published_at", new Date().toISOString());
        formData.append("featured_image", imageFile);

        if (isEditing) {
          await api.patch(`/blog/posts/${slug}/update/`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          await api.post("/blog/posts/create/", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      } else {
        const postData = buildPostData();
        if (isEditing) {
          await api.patch(`/blog/posts/${slug}/update/`, postData);
        } else {
          await api.post("/blog/posts/create/", postData);
        }
      }
      navigate("/blog/manage");
    } catch (err: any) {
      const data = err.response?.data;
      setError(data ? JSON.stringify(data) : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);
  };

  return (
    <section style={{ padding: "40px 0", minHeight: "calc(100vh - 56px)", background: "#f8f9fa" }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">{isEditing ? "编辑文章" : "新建文章"}</h3>
          <Link to="/blog/manage" className="btn btn-sm btn-outline-dark">
            <i className="fas fa-arrow-left me-1"></i>返回管理
          </Link>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-bold">标题</label>
                <input type="text" className="form-control" value={title}
                  onChange={(e) => setTitle(e.target.value)} placeholder="文章标题" required />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">URL 别名 (slug)</label>
                <input type="text" className="form-control" value={postSlug}
                  onChange={(e) => setPostSlug(e.target.value)} placeholder="留空则自动生成" />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">分类</label>
                  <select className="form-select" value={category}
                    onChange={(e) => setCategory(Number(e.target.value))}>
                    <option value={0}>请选择分类（可选）</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    <i className="fab fa-weixin me-1" style={{ color: "#07c160" }}></i>微信链接
                  </label>
                  <input type="url" className="form-control" value={wechatLink}
                    onChange={(e) => setWechatLink(e.target.value)}
                    placeholder="https://mp.weixin.qq.com/s/..." />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">标签</label>
                <div className="d-flex gap-2 flex-wrap">
                  {tags.map((tag) => (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                      className={`btn btn-sm ${selectedTags.includes(tag.id) ? "btn-primary" : "btn-outline-secondary"}`}>
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">封面图片</label>
                <div>
                  <input type="file" ref={fileInputRef} accept="image/*"
                    onChange={handleImageChange} style={{ display: "none" }} />
                  <button type="button" className="btn btn-outline-secondary mb-2"
                    onClick={() => fileInputRef.current?.click()}>
                    <i className="fas fa-upload me-1"></i>上传封面图片
                  </button>
                </div>
                {(imagePreview || existingImage) && (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={imagePreview || existingImage}
                      alt="封面预览"
                      style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, objectFit: "cover" }}
                    />
                    {imagePreview && (
                      <button type="button" className="btn btn-sm btn-danger"
                        style={{ position: "absolute", top: -8, right: -8, borderRadius: "50%", width: 24, height: 24, padding: 0 }}
                        onClick={() => { setImageFile(null); setImagePreview(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                        ×
                      </button>
                    )}
                  </div>
                )}
                <small className="text-muted d-block mt-1">
                  不传图片则根据分类使用默认图标
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">摘要</label>
                <textarea className="form-control" rows={3} value={summary}
                  onChange={(e) => setSummary(e.target.value)} placeholder="文章摘要" />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">正文内容</label>
                <textarea className="form-control" rows={12} value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="支持简单格式：## 标题, **加粗**, - 列表项"
                  style={{ fontFamily: "monospace" }} />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">状态</label>
                <div className="d-flex gap-3">
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="draft"
                      checked={status === "draft"} onChange={() => setStatus("draft")} />
                    <label className="form-check-label" htmlFor="draft">草稿</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="published"
                      checked={status === "published"} onChange={() => setStatus("published")} />
                    <label className="form-check-label" htmlFor="published">发布</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-lg text-white" disabled={loading}
              style={{ background: "#667eea", border: "none" }}>
              {loading ? "保存中..." : (isEditing ? "更新文章" : "创建文章")}
            </button>
            <Link to="/blog/manage" className="btn btn-lg btn-outline-secondary">取消</Link>
          </div>
        </form>
      </div>
    </section>
  );
};

export default BlogEditor;
