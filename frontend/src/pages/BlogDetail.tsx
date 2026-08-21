import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import type { BlogPost } from "../types";
import { AnimatedPage, MotionIcon } from "../components/PublicMotion";

const BlogDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.get(`/blog/posts/${slug}/`).then((res) => setPost(res.data)).catch(() => setPost(null)).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!post?.category_slug) return;
    api.get(`/blog/posts/?category=${post.category_slug}`).then((res) => setRelated(res.data.filter((item: BlogPost) => item.slug !== post.slug).slice(0, 2))).catch(() => setRelated([]));
  }, [post?.category_slug, post?.slug]);

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, (window.scrollY / height) * 100)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const renderInline = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>);
  const renderContent = (content: string) => content.split("\n").map((line, index) => {
    if (line.startsWith("## ")) return <h2 key={index}>{line.replace("## ", "")}</h2>;
    if (line.startsWith("### ")) return <h3 key={index}>{line.replace("### ", "")}</h3>;
    if (line.startsWith("- ")) return <li key={index}>{renderInline(line.replace("- ", ""))}</li>;
    if (line.trim() === "") return <br key={index} />;
    return <p key={index}>{renderInline(line)}</p>;
  });

  if (loading) return <div className="text-center py-5"><p>加载中...</p></div>;
  if (!post) return <div className="text-center py-5"><p>文章不存在</p></div>;

  return (
    <AnimatedPage className="article-public-page">
      <div className="article-reading-progress" style={{ width: `${progress}%` }} />
      <section className="article-detail-section">
        <div className="article-detail-grid" />
        <div className="site-container article-layout">
          <aside className="article-side motion-reveal">
            <Link to="/blog"><i className="fas fa-arrow-left" />返回资讯中心</Link>
            <div><small>READING PROGRESS</small><b>{Math.round(progress)}%</b><span><i style={{ width: `${progress}%` }} /></span></div>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><i className="fas fa-arrow-up" />返回顶部</button>
          </aside>
          <div>
            <article className="article-paper motion-reveal">
              <div className="article-tech-mark"><MotionIcon variant="report" /></div>
              <p className="article-meta">{post.category_name} · {post.author_name} · {new Date(post.published_at).toLocaleDateString("zh-CN")} · {post.views} 阅读</p>
              <h1>{post.title}</h1>
              <div className="article-tags">{post.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}</div>
              <div className="article-divider" />
              <div className="article-content">{post.content && renderContent(post.content)}</div>
            </article>
            {related.length > 0 && <section className="related-reading motion-reveal"><span className="eyebrow">RELATED READING</span><h2>继续阅读</h2><div>{related.map((item) => <Link to={`/blog/${item.slug}`} key={item.id}><small>{item.category_name}</small><h3>{item.title}</h3><p>{item.summary}</p><span>阅读全文 <i className="fas fa-arrow-right" /></span></Link>)}</div></section>}
          </div>
        </div>
      </section>
    </AnimatedPage>
  );
};

export default BlogDetail;
