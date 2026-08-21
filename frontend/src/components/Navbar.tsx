import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <Link to="/browser" style={styles.brandLink}>
          🧬 IGV 基因组浏览器
        </Link>
      </div>
      <div style={styles.links}>
        {isAuthenticated ? (
          <>
            <span style={styles.username}>{user?.username}</span>
            <button onClick={handleLogout} style={styles.btnLogout}>
              退出
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.link}>
              登录
            </Link>
            <Link to="/register" style={styles.link}>
              注册
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    height: "56px",
    backgroundColor: "#1a1a2e",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  brand: {
    fontSize: "18px",
    fontWeight: "bold",
  },
  brandLink: {
    color: "#fff",
    textDecoration: "none",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  link: {
    color: "#a0c4ff",
    textDecoration: "none",
  },
  username: {
    color: "#a0c4ff",
    fontSize: "14px",
  },
  btnLogout: {
    padding: "6px 16px",
    backgroundColor: "#e63946",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  },
};

export default Navbar;
