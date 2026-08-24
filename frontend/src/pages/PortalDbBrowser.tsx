import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import PortalSidebar from "../components/PortalSidebar";

type TableKey = "users" | "patient_slots" | "sample_bundles" | "bundle_files" | "reports";

type CatalogTable = {
  key: TableKey;
  label: string;
  model: string;
  editable: boolean;
  description: string;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  role: string;
  patient_no: string;
  is_bioinfo: boolean;
  date_joined: string;
  last_login: string;
};

const TABLE_ENDPOINTS: Record<Exclude<TableKey, "users">, string> = {
  patient_slots: "/reports/db-browser/patient-slots/",
  sample_bundles: "/reports/db-browser/sample-bundles/",
  bundle_files: "/reports/db-browser/bundle-files/",
  reports: "/reports/db-browser/reports/",
};

const ROLE_OPTIONS = [
  { value: "customer", label: "客户/患者" },
  { value: "analyst", label: "生信分析员" },
  { value: "reviewer", label: "审核员" },
  { value: "admin", label: "管理员" },
];

const emptyUserForm = {
  username: "",
  email: "",
  password: "",
  role: "customer",
  patient_no: "",
  is_active: true,
  is_bioinfo: false,
};

function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

const PortalDbBrowser: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tableKey = (params.get("table") || "users") as TableKey;

  const [catalog, setCatalog] = useState<CatalogTable[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyUserForm });
  const [saving, setSaving] = useState(false);

  const currentMeta = catalog.find((t) => t.key === tableKey);
  const isAdmin = user?.role === "admin" || !!user?.is_staff;
  const canEditUsers = tableKey === "users" && isAdmin && (currentMeta?.editable ?? true);

  const loadCatalog = useCallback(() => {
    api.get("/reports/db-browser/")
      .then((res) => setCatalog(res.data.tables || []))
      .catch(() => setCatalog([]));
  }, []);

  const loadRows = useCallback(() => {
    setLoading(true);
    setError("");
    const req = tableKey === "users"
      ? api.get("/auth/admin/users/")
      : api.get(TABLE_ENDPOINTS[tableKey as Exclude<TableKey, "users">]);
    req
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setRows([]);
        setError(err.response?.data?.detail || "加载失败（需要内部账号）");
      })
      .finally(() => setLoading(false));
  }, [tableKey]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const columns = useMemo(() => {
    if (!rows.length) return [] as string[];
    return Object.keys(rows[0]);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query]);

  function selectTable(key: TableKey) {
    setParams({ table: key });
    setQuery("");
    setShowForm(false);
    setEditing(null);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyUserForm });
    setShowForm(true);
  }

  function openEdit(row: UserRow) {
    setEditing(row);
    setForm({
      username: row.username,
      email: row.email || "",
      password: "",
      role: row.role || "customer",
      patient_no: row.patient_no || "",
      is_active: row.is_active,
      is_bioinfo: row.is_bioinfo,
    });
    setShowForm(true);
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditUsers) return;
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          email: form.email,
          role: form.role,
          patient_no: form.patient_no,
          is_active: form.is_active,
          is_bioinfo: form.is_bioinfo,
        };
        if (form.password.trim()) payload.password = form.password.trim();
        await api.patch(`/auth/admin/users/${editing.id}/`, payload);
      } else {
        await api.post("/auth/admin/users/", {
          username: form.username.trim(),
          email: form.email,
          password: form.password,
          role: form.role,
          patient_no: form.patient_no,
          is_active: form.is_active,
          is_bioinfo: form.is_bioinfo,
        });
      }
      setShowForm(false);
      setEditing(null);
      loadRows();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(row: UserRow) {
    if (!canEditUsers) return;
    if (!window.confirm(`确认删除用户 ${row.username}？此操作不可恢复。`)) return;
    try {
      await api.delete(`/auth/admin/users/${row.id}/`);
      loadRows();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail || "删除失败");
    }
  }

  return (
    <div className="portal-page">
      <PortalSidebar />
      <main className="portal-main">
        <header className="portal-topbar">
          <div>
            <h1>数据表浏览</h1>
            <p>数据库记录 · {user?.username || "内部用户"}</p>
          </div>
          <div className="portal-top-actions">
            <button type="button" className="button button-outline" onClick={loadRows}>刷新</button>
            {canEditUsers && (
              <button type="button" className="button button-primary" onClick={openCreate}>新建用户</button>
            )}
          </div>
        </header>

        <section className="portal-content">
          <div className="db-table-tabs">
            {(catalog.length ? catalog : [
              { key: "users", label: "用户与权限", editable: isAdmin },
              { key: "patient_slots", label: "患者报告台账", editable: false },
              { key: "sample_bundles", label: "样本报告包", editable: false },
              { key: "bundle_files", label: "报告包文件路径", editable: false },
              { key: "reports", label: "门户报告", editable: false },
            ] as CatalogTable[]).map((t) => (
              <button
                key={t.key}
                type="button"
                className={tableKey === t.key ? "active" : undefined}
                onClick={() => selectTable(t.key)}
              >
                {t.label}
                <small>{t.editable ? "可编辑" : "只读"}</small>
              </button>
            ))}
          </div>

          <div className="portal-panel">
            <div className="panel-head">
              <div>
                <h2>{currentMeta?.label || "数据表"}</h2>
                <p>
                  {currentMeta?.description || "查看数据库记录"}
                  {currentMeta?.model ? ` · ${currentMeta.model}` : ""}
                  {canEditUsers ? " · 管理员可增删改" : " · 仅查看"}
                </p>
              </div>
              <div className="project-search">
                <i className="fas fa-search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="筛选当前表"
                />
              </div>
            </div>

            {error && <div className="cloud-create-error">{error}</div>}

            {loading ? (
              <div className="empty-state">加载中…</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">暂无数据</div>
            ) : (
              <div className="table-wrap">
                <table className="project-table">
                  <thead>
                    <tr>
                      {columns.map((col) => <th key={col}>{col}</th>)}
                      {canEditUsers && <th>操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, idx) => (
                      <tr key={String(row.id ?? idx)}>
                        {columns.map((col) => (
                          <td key={col} title={cell(row[col])}>
                            {col === "abs_path" || col === "root_dir" || col === "pdf_url"
                              ? <code className="path-cell">{cell(row[col])}</code>
                              : cell(row[col])}
                          </td>
                        ))}
                        {canEditUsers && (
                          <td>
                            <div className="row-actions">
                              <button type="button" className="button button-small button-outline" onClick={() => openEdit(row as unknown as UserRow)}>编辑</button>
                              <button type="button" className="button button-small button-outline" onClick={() => deleteUser(row as unknown as UserRow)}>删除</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {showForm && canEditUsers && (
        <div className="portal-modal-backdrop" onClick={() => !saving && setShowForm(false)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <h2>{editing ? `编辑用户 · ${editing.username}` : "新建用户"}</h2>
                <p>写入 auth.User + accounts.UserProfile</p>
              </div>
              <button type="button" className="icon-action" onClick={() => setShowForm(false)} aria-label="关闭">
                <i className="fas fa-times" />
              </button>
            </div>
            <form className="cloud-project-form" onSubmit={saveUser}>
              <div className="form-grid">
                {!editing && (
                  <label>
                    用户名
                    <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </label>
                )}
                <label>
                  邮箱
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label>
                  {editing ? "新密码（留空不改）" : "密码"}
                  <input
                    type="password"
                    required={!editing}
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
                <label>
                  角色
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  患者编号（可选）
                  <input value={form.patient_no} onChange={(e) => setForm({ ...form, patient_no: e.target.value })} placeholder="如 P20260824A" />
                </label>
                <label>
                  启用
                  <select
                    value={form.is_active ? "1" : "0"}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
                  >
                    <option value="1">是</option>
                    <option value="0">否</option>
                  </select>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowForm(false)} disabled={saving}>取消</button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalDbBrowser;
