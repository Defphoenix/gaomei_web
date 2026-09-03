import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import PortalSidebar from "../components/PortalSidebar";

type TableKey =
  | "users"
  | "patients"
  | "reports"
  | "assets"
  | "variants"
  | "access_logs"
  | "ingest_events"
  | "api_keys";

type Mode = "list" | "create" | "edit" | "view";

type CatalogTable = {
  key: TableKey;
  label: string;
  model: string;
  editable: boolean;
  description: string;
};

const ENDPOINTS: Record<Exclude<TableKey, "users">, string> = {
  patients: "/v1/db-browser/patients/",
  reports: "/v1/db-browser/reports/",
  assets: "/v1/db-browser/assets/",
  variants: "/v1/db-browser/variants/",
  access_logs: "/v1/db-browser/access-logs/",
  ingest_events: "/v1/db-browser/ingest-events/",
  api_keys: "/v1/db-browser/api-keys/",
};

const ROLE_OPTIONS = [
  { value: "customer", label: "客户/患者" },
  { value: "analyst", label: "生信分析员" },
  { value: "reviewer", label: "审核员" },
  { value: "admin", label: "管理员" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "分析中" },
  { value: "review", label: "待审核" },
  { value: "released", label: "已发布" },
  { value: "void", label: "已作废" },
];

const SEX_OPTIONS = [
  { value: "", label: "请选择" },
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" },
  { value: "unknown", label: "未知" },
];

const PAGE_TIPS: Record<TableKey, string> = {
  users: "创建登录账号、分配角色。患者门户绑定请到「患者报告」→ 管理绑定。",
  patients: "患者编号永久保留，不可删除；请到「患者报告」管理账号绑定。",
  reports: "管理报告状态与内容；附件在报告编辑页中统一维护。",
  assets: "每个报告一个 data/<报告ID>/ 文件夹；点开查看 JSON / BAM / PDF。",
  variants: "只读浏览报告位点索引；完整变异请走 WES JSON 导入。",
  access_logs: "审计报告查看与下载行为。",
  ingest_events: "查看节点机报告包导入结果与错误详情。",
  api_keys: "管理导入鉴权 Key；明文仅在创建时显示一次。",
};


const ASSET_FILE_COLUMNS = [
  { key: "name", label: "文件名" },
  { key: "asset_type", label: "类型" },
  { key: "file_path", label: "路径" },
  { key: "file_size", label: "大小" },
  { key: "created_at", label: "上传时间" },
];

const LIST_COLUMNS: Record<TableKey, { key: string; label: string }[]> = {
  users: [
    { key: "username", label: "用户名" },
    { key: "role", label: "角色" },
    { key: "patient_no", label: "绑定患者" },
    { key: "email", label: "邮箱" },
    { key: "is_active", label: "状态" },
  ],
  patients: [
    { key: "patient_no", label: "患者编号" },
    { key: "name", label: "姓名" },
    { key: "sex", label: "性别" },
    { key: "phone", label: "电话" },
    { key: "username", label: "绑定账号" },
    { key: "report_count", label: "报告数" },
    { key: "updated_at", label: "更新时间" },
  ],
  reports: [
    { key: "report_number", label: "报告编号" },
    { key: "patient_no", label: "患者编号" },
    { key: "patient_name", label: "患者" },
    { key: "report_type", label: "类型" },
    { key: "status", label: "状态" },
    { key: "sample_id", label: "样本号" },
    { key: "report_date", label: "报告日期" },
  ],
  assets: [
    { key: "folder", label: "文件夹" },
    { key: "report_number", label: "报告编号" },
    { key: "patient_name", label: "患者" },
    { key: "sample_id", label: "样本" },
    { key: "file_count", label: "文件数" },
    { key: "status", label: "状态" },
    { key: "updated_at", label: "更新时间" },
  ],
  variants: [
    { key: "gene", label: "基因" },
    { key: "chromosome", label: "染色体" },
    { key: "position", label: "位置" },
    { key: "ref", label: "Ref" },
    { key: "alt", label: "Alt" },
    { key: "variant_type", label: "类型" },
    { key: "report_number", label: "报告" },
  ],
  access_logs: [
    { key: "created_at", label: "时间" },
    { key: "username", label: "用户" },
    { key: "action", label: "动作" },
    { key: "report_number", label: "报告" },
    { key: "ip_address", label: "IP" },
    { key: "user_agent", label: "设备" },
  ],
  ingest_events: [
    { key: "created_at", label: "时间" },
    { key: "status", label: "状态" },
    { key: "external_id", label: "外部 ID" },
    { key: "report_number", label: "报告" },
    { key: "api_key", label: "API Key" },
    { key: "error_detail", label: "错误" },
  ],
  api_keys: [
    { key: "name", label: "名称" },
    { key: "key_prefix", label: "前缀" },
    { key: "scope", label: "Scope" },
    { key: "is_active", label: "状态" },
    { key: "last_used_at", label: "最近使用" },
    { key: "created_at", label: "创建时间" },
  ],
};

function sexLabel(v: string) {
  return SEX_OPTIONS.find((o) => o.value === v)?.label || v || "—";
}
function roleLabel(v: string) {
  return ROLE_OPTIONS.find((o) => o.value === v)?.label || v || "—";
}
function statusLabel(v: string) {
  return STATUS_OPTIONS.find((o) => o.value === v)?.label || v || "—";
}
function statusClass(v: string) {
  if (v === "released") return "ok";
  if (v === "review") return "warn";
  if (v === "void") return "bad";
  return "muted";
}
function formatSize(n: unknown) {
  const num = Number(n || 0);
  if (!num) return "—";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}
function cellText(col: string, row: Record<string, unknown>) {
  const v = row[col];
  if (col === "sex") return sexLabel(String(v || ""));
  if (col === "role") return roleLabel(String(v || ""));
  if (col === "status" && typeof v === "string" && ["draft", "review", "released", "void"].includes(v)) {
    return statusLabel(v);
  }
  if (col === "is_active") return v ? "启用" : "停用";
  if (col === "file_size") return formatSize(v);
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "是" : "否";
  return String(v);
}

const emptyPatient = {
  patient_no: "", name: "", sex: "", phone: "", email: "",
  birth_date: "", id_card: "", address: "", remarks: "", username: "", is_active: true,
};
const emptyReport = {
  patient_no: "", report_number: "", title: "", status: "draft",
  product_code: "WES_TN", report_type: "mutation", sample_id: "",
  wes_report_id: "", tumor_sample_id: "", normal_sample_id: "",
  genome_build: "GRCh38", report_date: "", summary: "", conclusion: "",
};
const emptyUser = {
  username: "", email: "", password: "", role: "customer",
  patient_no: "", is_active: true, is_bioinfo: false,
};
const emptyAsset = {
  name: "", asset_type: "other", file_path: "", external_url: "", mime_type: "",
};
const emptyKey = { name: "", scope: "wes_package", is_active: true };

const PortalDbBrowser: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tableKey = (params.get("table") || "assets") as TableKey;
  const mode = (params.get("mode") || "list") as Mode;
  const editId = params.get("id");

  const [catalog, setCatalog] = useState<CatalogTable[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [patientOptions, setPatientOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleGroup, setRoleGroup] = useState("");
  const [geneFilter, setGeneFilter] = useState("");
  const [assetFolderId, setAssetFolderId] = useState<string>("");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [formAssets, setFormAssets] = useState<Record<string, unknown>[]>([]);
  const [saving, setSaving] = useState(false);
  const [rawKeyNotice, setRawKeyNotice] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const isAdmin = user?.role === "admin" || !!user?.is_staff;
  const currentMeta = catalog.find((t) => t.key === tableKey)
    || { key: tableKey, label: LIST_COLUMNS[tableKey] ? tableKey : "数据", model: "", editable: true, description: "" };
  const editable = Boolean(isAdmin && (currentMeta.editable ?? true) && !["variants", "access_logs", "ingest_events"].includes(tableKey));
  const onForm = mode === "create" || mode === "edit" || mode === "view";
  const readOnlyForm = mode === "view" || !editable;

  const goList = useCallback((table = tableKey) => {
    setParams({ table });
    setError("");
    setRawKeyNotice("");
  }, [setParams, tableKey]);

  const goCreate = () => setParams({ table: tableKey, mode: "create" });
  const goEdit = (id: number | string, viewOnly = false) => {
    setParams({ table: tableKey, mode: viewOnly ? "view" : "edit", id: String(id) });
  };

  const loadCatalog = useCallback(() => {
    api.get("/v1/db-browser/")
      .then((res) => setCatalog(res.data.tables || []))
      .catch(() => setCatalog([]));
  }, []);

  const loadOptions = useCallback(() => {
    if (!isAdmin) return;
    Promise.all([
      api.get("/auth/admin/users/").catch(() => ({ data: [] })),
      api.get("/v1/db-browser/patients/").catch(() => ({ data: [] })),
    ]).then(([u, p]) => {
      setUserOptions((Array.isArray(u.data) ? u.data : []).map((x: Record<string, unknown>) => ({
        value: String(x.username || ""),
        label: roleLabel(String(x.role || "")),
      })).filter((x: { value: string }) => x.value));
      setPatientOptions((Array.isArray(p.data) ? p.data : []).map((x: Record<string, unknown>) => ({
        value: String(x.patient_no || ""),
        label: String(x.name || ""),
      })).filter((x: { value: string }) => x.value));
    });
  }, [isAdmin]);

  const loadRows = useCallback(() => {
    setLoading(true);
    setError("");
    let req;
    if (tableKey === "users") {
      req = api.get("/auth/admin/users/");
    } else if (tableKey === "assets") {
      req = assetFolderId
        ? api.get(`/v1/db-browser/assets/?report_id=${assetFolderId}`)
        : api.get("/v1/db-browser/assets/?view=folders");
    } else {
      req = api.get(ENDPOINTS[tableKey as Exclude<TableKey, "users">]);
    }
    req
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setRows([]);
        setError(err.response?.data?.detail || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [tableKey, assetFolderId]);

  useEffect(() => { loadCatalog(); loadOptions(); }, [loadCatalog, loadOptions]);
  useEffect(() => {
    if (onForm) return;
    loadRows();
  }, [loadRows, onForm]);
  useEffect(() => {
    if (onForm) return;
    setPage(1);
    setQuery("");
    setStatusFilter("");
    setRoleGroup("");
    setGeneFilter("");
    setAssetFolderId("");
  }, [tableKey, onForm]);

  useEffect(() => {
    if (!onForm) return;
    setError("");
    setRawKeyNotice("");
    if (mode === "create") {
      if (tableKey === "patients") setForm({ ...emptyPatient });
      else if (tableKey === "reports") { setForm({ ...emptyReport }); setFormAssets([]); }
      else if (tableKey === "users") setForm({ ...emptyUser });
      else if (tableKey === "assets") setForm({ ...emptyAsset });
      else if (tableKey === "api_keys") setForm({ ...emptyKey });
      return;
    }
    if (!editId) return;
    setLoading(true);
    const load = async () => {
      try {
        if (tableKey === "patients") {
          const res = await api.get(`/v1/db-browser/patients/${editId}/`);
          setForm({ ...emptyPatient, ...res.data });
        } else if (tableKey === "reports") {
          const res = await api.get(`/v1/db-browser/reports/${editId}/`);
          setForm({ ...emptyReport, ...res.data });
          setFormAssets(Array.isArray(res.data.assets) ? res.data.assets : []);
        } else if (tableKey === "users") {
          const res = await api.get("/auth/admin/users/");
          const row = (Array.isArray(res.data) ? res.data : []).find((x: Record<string, unknown>) => String(x.id) === String(editId));
          if (!row) throw new Error("not found");
          setForm({ ...emptyUser, ...row, password: "" });
        } else if (tableKey === "assets") {
          const res = await api.get("/v1/db-browser/assets/");
          const row = (Array.isArray(res.data) ? res.data : []).find((x: Record<string, unknown>) => String(x.id) === String(editId));
          if (!row) throw new Error("not found");
          setForm({ ...emptyAsset, ...row });
        } else if (tableKey === "api_keys") {
          const res = await api.get("/v1/db-browser/api-keys/");
          const row = (Array.isArray(res.data) ? res.data : []).find((x: Record<string, unknown>) => String(x.id) === String(editId));
          if (!row) throw new Error("not found");
          setForm({ ...emptyKey, ...row });
        }
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || "加载详情失败");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [onForm, mode, editId, tableKey]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tableKey === "users" && roleGroup) {
      list = list.filter((r) => String(r.role || "") === roleGroup);
    }
    if (statusFilter && (tableKey === "reports" || tableKey === "ingest_events" || tableKey === "api_keys" || tableKey === "users")) {
      if (tableKey === "api_keys" || tableKey === "users") {
        list = list.filter((r) => String(!!r.is_active) === (statusFilter === "active" ? "true" : "false"));
      } else {
        list = list.filter((r) => String(r.status || "") === statusFilter);
      }
    }
    if (geneFilter && tableKey === "variants") {
      const g = geneFilter.trim().toLowerCase();
      list = list.filter((r) => String(r.gene || "").toLowerCase().includes(g));
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, query, statusFilter, roleGroup, geneFilter, tableKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (readOnlyForm) return;
    setSaving(true);
    setError("");
    setRawKeyNotice("");
    try {
      if (tableKey === "patients") {
        if (mode === "edit" && editId) await api.patch(`/v1/db-browser/patients/${editId}/`, form);
        else await api.post("/v1/db-browser/patients/", form);
      } else if (tableKey === "reports") {
        if (mode === "edit" && editId) await api.patch(`/v1/db-browser/reports/${editId}/`, form);
        else await api.post("/v1/db-browser/reports/", form);
      } else if (tableKey === "users") {
        if (mode === "edit" && editId) {
          const payload: Record<string, unknown> = {
            email: form.email, role: form.role, patient_no: form.patient_no,
            is_active: form.is_active, is_bioinfo: form.is_bioinfo,
          };
          if (String(form.password || "").trim()) payload.password = String(form.password).trim();
          await api.patch(`/auth/admin/users/${editId}/`, payload);
        } else {
          await api.post("/auth/admin/users/", form);
        }
      } else if (tableKey === "assets" && editId) {
        await api.patch(`/v1/db-browser/assets/${editId}/`, form);
      } else if (tableKey === "api_keys") {
        if (mode === "edit" && editId) await api.patch("/v1/db-browser/api-keys/", { id: Number(editId), ...form });
        else {
          const res = await api.post("/v1/db-browser/api-keys/", form);
          if (res.data?.raw_key) {
            setRawKeyNotice(`请立即保存明文 Key（仅此一次）：${res.data.raw_key}`);
            setSaving(false);
            return;
          }
        }
      }
      goList();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: Record<string, unknown>) {
    if (!editable || !row.id) return;
    const label = String(row.username || row.patient_no || row.report_number || row.name || row.id);
    if (!window.confirm(`确认删除 ${label}？`)) return;
    try {
      if (tableKey === "users") await api.delete(`/auth/admin/users/${row.id}/`);
      else if (tableKey === "patients") await api.delete(`/v1/db-browser/patients/${row.id}/`);
      else if (tableKey === "reports") await api.delete(`/v1/db-browser/reports/${row.id}/`);
      else if (tableKey === "assets") await api.delete(`/v1/db-browser/assets/${row.id}/`);
      loadRows();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail || "删除失败");
    }
  }

  async function deleteAsset(assetId: unknown) {
    if (!editable || !assetId) return;
    if (!window.confirm("确认删除该附件元数据？")) return;
    try {
      await api.delete(`/v1/db-browser/assets/${assetId}/`);
      setFormAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail || "删除失败");
    }
  }

  const listColumns = tableKey === "assets" && assetFolderId
    ? ASSET_FILE_COLUMNS
    : (LIST_COLUMNS[tableKey] || []);
  const canCreate = editable && ["users", "api_keys"].includes(tableKey) && !(tableKey === "assets" && !assetFolderId);

  const title = tableKey === "assets" && assetFolderId
    ? `文件管理 · data/${assetFolderId}`
    : (currentMeta.label || "管理");
  const listTip = tableKey === "assets" && assetFolderId
    ? `正在查看报告文件夹 data/${assetFolderId} 下的 JSON / BAM / PDF。`
    : PAGE_TIPS[tableKey];
  const formTitle = mode === "create" ? `新增${title.replace(/管理$/, "")}` : mode === "view" ? `查看${title.replace(/管理$/, "")}` : `编辑${title.replace(/管理$/, "")}`;

  function setField(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function renderListCell(col: string, row: Record<string, unknown>) {
    if (col === "folder" || col === "data_dir") {
      return <code className="admin-folder-path">{String(row.folder || row.data_dir || `data/${row.report_id || row.id}`)}</code>;
    }
    if (col === "types" && Array.isArray(row.types)) {
      return String(row.types.join(", ") || "—");
    }
    if (col === "status" && (tableKey === "reports" || tableKey === "assets")) {
      const st = String(row.status || "");
      return <span className={`admin-tag ${statusClass(st)}`}>{statusLabel(st)}</span>;
    }
    if (col === "is_active") {
      return <span className={`admin-tag ${row.is_active ? "ok" : "muted"}`}>{row.is_active ? "启用" : "停用"}</span>;
    }
    if (col === "status" && tableKey === "ingest_events") {
      const st = String(row.status || "");
      return <span className={`admin-tag ${st === "ok" || st === "success" ? "ok" : st ? "warn" : "muted"}`}>{st || "—"}</span>;
    }
    return cellText(col, row);
  }

  function renderFormBody() {
    if (tableKey === "patients") {
      return (
        <div className="admin-form-card">
          <div className="admin-form-grid one-col">
            <label>患者编号<span>*</span>
              <input required disabled={mode === "edit" || readOnlyForm} value={String(form.patient_no || "")} onChange={(e) => setField("patient_no", e.target.value)} placeholder="唯一标识，如 GM-P-001" />
            </label>
            <label>姓名<span>*</span>
              <input required disabled={readOnlyForm} value={String(form.name || "")} onChange={(e) => setField("name", e.target.value)} />
            </label>
            <label>性别
              <select disabled={readOnlyForm} value={String(form.sex || "")} onChange={(e) => setField("sex", e.target.value)}>
                {SEX_OPTIONS.map((o) => <option key={o.value || "empty"} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>出生日期
              <input type="date" disabled={readOnlyForm} value={String(form.birth_date || "")} onChange={(e) => setField("birth_date", e.target.value)} />
            </label>
            <label>电话
              <input disabled={readOnlyForm} value={String(form.phone || "")} onChange={(e) => setField("phone", e.target.value)} />
            </label>
            <label>身份证号
              <input disabled={readOnlyForm} value={String(form.id_card || "")} onChange={(e) => setField("id_card", e.target.value)} />
            </label>
            <label>邮箱
              <input disabled={readOnlyForm} value={String(form.email || "")} onChange={(e) => setField("email", e.target.value)} />
            </label>
            <label>地址
              <input disabled={readOnlyForm} value={String(form.address || "")} onChange={(e) => setField("address", e.target.value)} />
            </label>
            <label>绑定登录账号
              <select disabled={readOnlyForm} value={String(form.username || "")} onChange={(e) => setField("username", e.target.value)}>
                <option value="">（未绑定）</option>
                {userOptions.map((o) => <option key={o.value} value={o.value}>{o.value} · {o.label}</option>)}
              </select>
            </label>
            <label>备注
              <textarea disabled={readOnlyForm} rows={4} value={String(form.remarks || "")} onChange={(e) => setField("remarks", e.target.value)} />
            </label>
          </div>
        </div>
      );
    }

    if (tableKey === "reports") {
      return (
        <div className="admin-form-layout">
          <div className="admin-form-main">
            <section className="admin-form-card">
              <h3>基本信息</h3>
              <div className="admin-form-grid two-col">
                <label>报告编号<span>*</span>
                  <input required disabled={mode === "edit" || readOnlyForm} value={String(form.report_number || "")} onChange={(e) => setField("report_number", e.target.value)} />
                </label>
                <label>患者编号<span>*</span>
                  <select required disabled={readOnlyForm} value={String(form.patient_no || "")} onChange={(e) => setField("patient_no", e.target.value)}>
                    <option value="">请选择患者</option>
                    {patientOptions.map((o) => <option key={o.value} value={o.value}>{o.value} · {o.label}</option>)}
                  </select>
                </label>
                <label>报告类型
                  <input disabled={readOnlyForm} value={String(form.report_type || "")} onChange={(e) => setField("report_type", e.target.value)} />
                </label>
                <label>标题
                  <input disabled={readOnlyForm} value={String(form.title || "")} onChange={(e) => setField("title", e.target.value)} />
                </label>
                <label>报告日期
                  <input type="date" disabled={readOnlyForm} value={String(form.report_date || "")} onChange={(e) => setField("report_date", e.target.value)} />
                </label>
                <label>状态
                  <select disabled={readOnlyForm} value={String(form.status || "draft")} onChange={(e) => setField("status", e.target.value)}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label>基因组版本
                  <input disabled={readOnlyForm} value={String(form.genome_build || "")} onChange={(e) => setField("genome_build", e.target.value)} />
                </label>
                <label>样本号
                  <input disabled={readOnlyForm} value={String(form.sample_id || "")} onChange={(e) => setField("sample_id", e.target.value)} />
                </label>
                <label>肿瘤样本
                  <input disabled={readOnlyForm} value={String(form.tumor_sample_id || "")} onChange={(e) => setField("tumor_sample_id", e.target.value)} />
                </label>
                <label>对照样本
                  <input disabled={readOnlyForm} value={String(form.normal_sample_id || "")} onChange={(e) => setField("normal_sample_id", e.target.value)} />
                </label>
                <label>WES 盘符
                  <input disabled={readOnlyForm} value={String(form.wes_report_id || "")} onChange={(e) => setField("wes_report_id", e.target.value)} />
                </label>
                <label>产品码
                  <input disabled={readOnlyForm} value={String(form.product_code || "")} onChange={(e) => setField("product_code", e.target.value)} />
                </label>
              </div>
            </section>
            <section className="admin-form-card">
              <h3>报告内容</h3>
              <div className="admin-form-grid one-col">
                <label>摘要
                  <textarea disabled={readOnlyForm} rows={5} value={String(form.summary || "")} onChange={(e) => setField("summary", e.target.value)} />
                </label>
                <label>结论
                  <textarea disabled={readOnlyForm} rows={5} value={String(form.conclusion || "")} onChange={(e) => setField("conclusion", e.target.value)} />
                </label>
              </div>
            </section>
          </div>
          <aside className="admin-form-side">
            <section className="admin-form-card">
              <div className="admin-side-head">
                <h3>报告文件</h3>
              </div>
              {formAssets.length === 0 ? (
                <p className="admin-empty-hint">暂无附件。请通过报告包导入上传 PDF/BAM。</p>
              ) : (
                <ul className="admin-file-list">
                  {formAssets.map((a) => (
                    <li key={String(a.id)}>
                      <div>
                        <b>{String(a.name || a.asset_type)}</b>
                        <small>{String(a.asset_type || "")} · {formatSize(a.file_size)}</small>
                      </div>
                      <div className="admin-text-actions">
                        {a.download_url ? <a href={String(a.download_url)} target="_blank" rel="noreferrer">下载</a> : null}
                        {editable ? <button type="button" onClick={() => { void deleteAsset(a.id); }}>删除</button> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {editId ? (
                <div className="admin-side-links">
                  <Link to={`/reports/${editId}`}>打开 3D 报告</Link>
                  <Link to={`/browser?report=${editId}`}>打开 IGV</Link>
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      );
    }

    if (tableKey === "users") {
      return (
        <div className="admin-form-card">
          <div className="admin-form-grid one-col">
            {mode === "create" && (
              <label>用户名<span>*</span>
                <input required value={String(form.username || "")} onChange={(e) => setField("username", e.target.value)} />
              </label>
            )}
            <label>邮箱
              <input type="email" disabled={readOnlyForm} value={String(form.email || "")} onChange={(e) => setField("email", e.target.value)} />
            </label>
            <label>{mode === "edit" ? "新密码（留空不改）" : "密码"}
              <input type="password" required={mode === "create"} minLength={8} disabled={readOnlyForm} value={String(form.password || "")} onChange={(e) => setField("password", e.target.value)} />
            </label>
            <label>角色
              <select disabled={readOnlyForm} value={String(form.role || "customer")} onChange={(e) => setField("role", e.target.value)}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>绑定患者编号
              <select disabled={readOnlyForm} value={String(form.patient_no || "")} onChange={(e) => setField("patient_no", e.target.value)}>
                <option value="">（未绑定）</option>
                {patientOptions.map((o) => <option key={o.value} value={o.value}>{o.value} · {o.label}</option>)}
              </select>
            </label>
            <label>启用
              <select disabled={readOnlyForm} value={form.is_active ? "1" : "0"} onChange={(e) => setField("is_active", e.target.value === "1")}>
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
            </label>
          </div>
        </div>
      );
    }

    if (tableKey === "assets") {
      return (
        <div className="admin-form-card">
          <div className="admin-form-grid one-col">
            <label>名称<input disabled={readOnlyForm} value={String(form.name || "")} onChange={(e) => setField("name", e.target.value)} /></label>
            <label>类型<input disabled={readOnlyForm} value={String(form.asset_type || "")} onChange={(e) => setField("asset_type", e.target.value)} /></label>
            <label>file_path<input disabled={readOnlyForm} value={String(form.file_path || "")} onChange={(e) => setField("file_path", e.target.value)} /></label>
            <label>external_url<input disabled={readOnlyForm} value={String(form.external_url || "")} onChange={(e) => setField("external_url", e.target.value)} /></label>
            <label>mime_type<input disabled={readOnlyForm} value={String(form.mime_type || "")} onChange={(e) => setField("mime_type", e.target.value)} /></label>
          </div>
        </div>
      );
    }

    if (tableKey === "api_keys") {
      return (
        <div className="admin-form-card">
          <div className="admin-form-grid one-col">
            <label>名称<span>*</span>
              <input required disabled={mode === "edit" || readOnlyForm} value={String(form.name || "")} onChange={(e) => setField("name", e.target.value)} />
            </label>
            <label>scope
              <input disabled={readOnlyForm} value={String(form.scope || "")} onChange={(e) => setField("scope", e.target.value)} />
            </label>
            <label>启用
              <select disabled={readOnlyForm} value={form.is_active ? "1" : "0"} onChange={(e) => setField("is_active", e.target.value === "1")}>
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
            </label>
          </div>
        </div>
      );
    }

    return <div className="admin-form-card"><p>该模块为只读列表。</p></div>;
  }

  return (
    <div className="portal-page admin-console">
      <PortalSidebar />
      <main className="portal-main">
        <header className="portal-topbar admin-topbar">
          <div>
            <h1>{onForm ? formTitle : title}</h1>
            <p>{onForm ? "填写后点击右下角保存" : (currentMeta.description || "后台业务数据管理")}</p>
          </div>
          <div className="portal-top-actions">
            {onForm ? (
              <button type="button" className="button button-outline" onClick={() => goList()}>返回列表</button>
            ) : (
              <>
                {tableKey === "variants" && (
                  <button type="button" className="button button-outline" onClick={() => {
                    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "variants.json"; a.click();
                    URL.revokeObjectURL(url);
                  }}>导出</button>
                )}
                {canCreate && (
                  <button type="button" className="button button-primary" onClick={goCreate}>+ 新增</button>
                )}
              </>
            )}
          </div>
        </header>

        <section className="portal-content">
          {error && <div className="cloud-create-error">{error}</div>}
          {rawKeyNotice && <div className="cloud-create-error" style={{ background: "#e8f7ee" }}>{rawKeyNotice}</div>}

          {!onForm && (
            <>
              <div className="admin-toolbar">
                <div className="admin-filters">
                  <label className="admin-search">
                    <i className="fas fa-search" />
                    <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="搜索…" />
                  </label>
                  {tableKey === "users" && (
                    <div className="admin-group-tabs">
                      <button type="button" className={!roleGroup ? "active" : undefined} onClick={() => { setRoleGroup(""); setPage(1); }}>全部</button>
                      {ROLE_OPTIONS.map((o) => (
                        <button key={o.value} type="button" className={roleGroup === o.value ? "active" : undefined} onClick={() => { setRoleGroup(o.value); setPage(1); }}>{o.label}</button>
                      ))}
                    </div>
                  )}
                  {(tableKey === "users" || tableKey === "api_keys") && (
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                      <option value="">全部状态</option>
                      <option value="active">启用</option>
                      <option value="inactive">停用</option>
                    </select>
                  )}
                  {tableKey === "assets" && assetFolderId && (
                    <button type="button" className="button button-outline button-small" onClick={() => { setAssetFolderId(""); setPage(1); }}>
                      ← 返回文件夹列表
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-table-card">
                {loading ? (
                  <div className="empty-state">加载中…</div>
                ) : pageRows.length === 0 ? (
                  <div className="empty-state">暂无数据</div>
                ) : (
                  <div className="table-wrap">
                    <table className="project-table admin-table">
                      <thead>
                        <tr>
                          {listColumns.map((c) => <th key={c.key}>{c.label}</th>)}
                          <th className="admin-ops-col">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, idx) => (
                          <tr key={String(row.id ?? idx)}>
                            {listColumns.map((c) => (
                              <td key={c.key}>{renderListCell(c.key, row)}</td>
                            ))}
                            <td className="admin-ops-col">
                              <div className="admin-text-actions">
                                {tableKey === "assets" && !assetFolderId && (
                                  <button type="button" onClick={() => { setAssetFolderId(String(row.report_id || row.id)); setPage(1); }}>打开</button>
                                )}
                                {tableKey === "assets" && assetFolderId && row.download_url ? (
                                  <a href={String(row.download_url)} target="_blank" rel="noreferrer">下载</a>
                                ) : null}
                                {editable && tableKey !== "assets" && (
                                  <button type="button" onClick={() => goEdit(String(row.id))}>编辑</button>
                                )}
                                {editable && tableKey === "assets" && assetFolderId && (
                                  <button type="button" onClick={() => goEdit(String(row.id))}>编辑</button>
                                )}
                                {editable && ["users"].includes(tableKey) && (
                                  <button type="button" className="danger" onClick={() => { void deleteRow(row); }}>删除</button>
                                )}
                                {editable && tableKey === "assets" && assetFolderId && (
                                  <button type="button" className="danger" onClick={() => { void deleteRow(row); }}>删除</button>
                                )}
                                {!editable && tableKey !== "assets" && (
                                  <span style={{ color: "#9aa8b8" }}>—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="admin-pagination">
                  <span>共 {filtered.length} 条</span>
                  <div>
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
                    <b>{page} / {totalPages}</b>
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
                  </div>
                </div>
              </div>

              <div className="admin-tip-box">
                <b>本页能做什么</b>
                <p>{listTip}</p>
              </div>
            </>
          )}

          {onForm && (
            loading ? (
              <div className="empty-state">加载中…</div>
            ) : (
              <form className="admin-edit-page" onSubmit={saveForm}>
                {renderFormBody()}
                <div className="admin-form-footer">
                  <button type="button" className="button button-outline" onClick={() => goList()} disabled={saving}>取消</button>
                  {!readOnlyForm && (
                    <button type="submit" className="button button-primary" disabled={saving}>
                      {saving ? "保存中…" : "保存"}
                    </button>
                  )}
                </div>
              </form>
            )
          )}
        </section>
      </main>
    </div>
  );
};

export default PortalDbBrowser;
