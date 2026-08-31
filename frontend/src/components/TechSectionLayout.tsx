import React from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { TECH_CATEGORIES } from "../content/techCatalog";

const TechSectionLayout: React.FC = () => {
  const location = useLocation();
  const { slug } = useParams<{ slug?: string }>();
  const onHub = location.pathname === "/tech";

  return (
    <div className="tech-hub-page">
      <div className="tech-hub-layout">
        <aside className="tech-hub-sidebar">
          <div className="tech-hub-sidebar-head">
            <Link to="/tech" className={onHub ? "active" : ""}>
              技术平台总览
            </Link>
          </div>
          <nav>
            {TECH_CATEGORIES.map((cat) => (
              <div className="tech-hub-group" key={cat.id}>
                <span className="tech-hub-group-title">{cat.title}</span>
                {cat.links.map((link) => (
                  <Link
                    key={link.slug}
                    to={`/tech/${link.slug}`}
                    className={slug === link.slug ? "active" : ""}
                    title={link.brief}
                  >
                    {link.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="tech-hub-sidebar-foot">
            <a href="/assets/tech-platform-architecture.html" target="_blank" rel="noreferrer">
              架构图 <i className="fas fa-external-link-alt" />
            </a>
            <Link to="/contact#consultation-form">预约咨询</Link>
          </div>
        </aside>
        <div className="tech-hub-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default TechSectionLayout;
