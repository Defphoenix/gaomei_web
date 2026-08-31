import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ReportDetail from "./pages/ReportDetail";
import GenomeBrowser from "./pages/GenomeBrowser";
import BlogList from "./pages/BlogList";
import BlogDetail from "./pages/BlogDetail";
import BlogManage from "./pages/BlogManage";
import BlogEditor from "./pages/BlogEditor";
import BioBlogList from "./pages/BioBlogList";
import BioBlogDetail from "./pages/BioBlogDetail";
import BioBlogManage from "./pages/BioBlogManage";
import BioBlogEditor from "./pages/BioBlogEditor";
import AboutPage from "./pages/AboutPage";
import { ContactPage } from "./pages/OfficialPages";
import ProductsPage from "./pages/ProductsPage";
import TechSectionLayout from "./components/TechSectionLayout";
import TechHubPage from "./pages/tech/TechHubPage";
import TechArticlePage from "./pages/tech/TechArticlePage";
import PersonalReports from "./pages/PersonalReports";
import ScrollManager from "./components/ScrollManager";
import ResetPassword from "./pages/ResetPassword";
import PatientReportsAdmin from "./pages/PatientReportsAdmin";
import PortalDbBrowser from "./pages/PortalDbBrowser";

const AppShell: React.FC = () => {
  const location = useLocation();
  const isPortal = location.pathname === "/dashboard"
    || location.pathname === "/patient-reports"
    || location.pathname === "/db-browser";
  const isReportDetail = location.pathname.startsWith("/reports/");
  const isAuthPage = ["/login", "/register", "/reset-password"].includes(location.pathname);
  const isProducts = location.pathname.startsWith("/products");
  const hidePublicChrome = isPortal || isReportDetail || isAuthPage;

  return (
    <>
        <ScrollManager />
        {!hidePublicChrome && <Header />}
        <main className={isProducts ? "main-products" : undefined}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/tech" element={<TechSectionLayout />}>
              <Route index element={<TechHubPage />} />
              <Route path=":slug" element={<TechArticlePage />} />
            </Route>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<ProductsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/manage" element={<ProtectedRoute roles={["admin"]}><BlogManage /></ProtectedRoute>} />
            <Route path="/blog/editor" element={<ProtectedRoute roles={["admin"]}><BlogEditor /></ProtectedRoute>} />
            <Route path="/blog/editor/:slug" element={<ProtectedRoute roles={["admin"]}><BlogEditor /></ProtectedRoute>} />
            <Route path="/blog/:slug" element={<BlogDetail />} />
            <Route path="/bioblog" element={<ProtectedRoute roles={["admin", "analyst", "reviewer"]}><BioBlogList /></ProtectedRoute>} />
            <Route path="/bioblog/manage" element={<ProtectedRoute roles={["admin", "analyst"]}><BioBlogManage /></ProtectedRoute>} />
            <Route path="/bioblog/editor" element={<ProtectedRoute roles={["admin", "analyst"]}><BioBlogEditor /></ProtectedRoute>} />
            <Route path="/bioblog/editor/:slug" element={<ProtectedRoute roles={["admin", "analyst"]}><BioBlogEditor /></ProtectedRoute>} />
            <Route path="/bioblog/:slug" element={<ProtectedRoute roles={["admin", "analyst", "reviewer"]}><BioBlogDetail /></ProtectedRoute>} />
            <Route path="/my-reports" element={<ProtectedRoute><PersonalReports /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute roles={["admin", "analyst", "reviewer"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/patient-reports" element={<ProtectedRoute roles={["admin", "analyst", "reviewer"]}><PatientReportsAdmin /></ProtectedRoute>} />
            <Route path="/db-browser" element={<ProtectedRoute roles={["admin"]}><PortalDbBrowser /></ProtectedRoute>} />
            <Route path="/reports/:id" element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />
            <Route path="/browser" element={<ProtectedRoute><GenomeBrowser /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {!hidePublicChrome && !isProducts && <Footer />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
