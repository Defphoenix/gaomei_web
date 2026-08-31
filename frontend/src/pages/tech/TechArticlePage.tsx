import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AnimatedPage } from "../../components/PublicMotion";
import { getTechArticle } from "../../content/techArticles";
import { findTechLink } from "../../content/techCatalog";

const TechArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getTechArticle(slug) : undefined;

  if (!slug || !article) {
    return <Navigate to="/tech" replace />;
  }

  return (
    <AnimatedPage className="tech-article">
      <header className="tech-article-head">
        <span className="eyebrow">{article.categoryTitle}</span>
        <h1>{article.title}</h1>
        <p className="tech-article-sub">{article.subtitle}</p>
        <p className="tech-article-intro">{article.intro}</p>
      </header>

      {article.sections.map((section) => (
        <section className="tech-article-section" key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="check-list">
              {section.bullets.map((b) => (
                <li key={b}><i className="fas fa-check" />{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <footer className="tech-article-foot">
        <h3>相关技术</h3>
        <div className="tech-related-links">
          {article.relatedSlugs.map((rel) => {
            const meta = findTechLink(rel);
            return (
              <Link key={rel} to={`/tech/${rel}`}>{meta?.link.title ?? rel}</Link>
            );
          })}
        </div>
        <Link className="button button-primary" to="/contact#consultation-form">
          咨询此技术方案
        </Link>
      </footer>
    </AnimatedPage>
  );
};

export default TechArticlePage;
