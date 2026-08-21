import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import type { Report } from "../types";

type PortalRole = "admin" | "analyst" | "reviewer" | "client";

type BridgeProject = {
  id: string; project_code: string; project_name: string; patient_no: string; patient_name: string;
  status: string; status_label: string; sync_status: string; sync_status_label: string;
  current_revision: number; samples: { sample_id: string; role: string; local_path?: string }[];
  latest_job?: { id: string; status: string; status_label: string; progress_percent: number } | null;
};

const emptyProject = {
  project_code: "", project_name: "", patient_no: "", patient_name: "", received_at: "",
  tumor_sample_id: "", tumor_fastq_dir: "", normal_sample_id: "", normal_fastq_dir: "",
  reference_profile: "grch38_wes", threads: 8, memory_gb: 32, min_tumor_af: 0.02, min_tlod: 6.3,
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [rolePreview, setRolePreview] = useState<PortalRole | null>(null);
  const [bridgeProjects, setBridgeProjects] = useState<BridgeProject[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "csv">("single");
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState("");
  const [csvResult, setCsvResult] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get("/reports/").then((res) => setReports(res.data)).catch(() => undefined).finally(() => setLoading(false));
    api.get("/bridge/projects/").then((res) => setBridgeProjects(res.data)).catch(() => undefined);
  }, []);

  const actualRole: PortalRole = user?.role === "customer" ? "client" : (user?.role as PortalRole) || (user?.is_staff ? "admin" : user?.is_bioinfo ? "analyst" : "client");
  const role = rolePreview || actualRole;
  const roleLabel = { admin: "管理员", analyst: "生信分析员", reviewer: "审核员", client: "客户" }[role];
  const projects = useMemo(() => bridgeProjects.filter((p) => `${p.project_code}${p.project_name}${p.patient_name}${p.patient_no}${p.samples.map((s) => s.sample_id).join("")}`.toLowerCase().includes(query.toLowerCase())), [bridgeProjects, query]);
  const canOperate = role === "admin" || role === "analyst" || role === "reviewer";

  async function refreshProjects() {
    const response = await api.get("/bridge/projects/");
    setBridgeProjects(response.data);
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setCreating(true); setCreateError("");
    try {
      await api.post("/bridge/projects/", { ...projectForm, node_id: "node9-wes-executor" });
      setProjectForm(emptyProject); setShowCreate(false); await refreshProjects();
    } catch (error: any) { setCreateError(error.response?.data?.detail || "项目创建失败"); }
    finally { setCreating(false); }
  }

  async function importCsv(validateOnly: boolean) {
    if (!csvFile) { setCreateError("请先选择CSV文件"); return; }
    const payload = new FormData(); payload.append("file", csvFile);
    payload.append("validate_only", String(validateOnly)); payload.append("node_id", "node9-wes-executor");
    setCreating(true); setCreateError(""); setCsvResult(null);
    try {
      const response = await api.post("/bridge/projects/import/", payload, { headers: { "Content-Type": "multipart/form-data" } });
      setCsvResult(response.data); if (!validateOnly) await refreshProjects();
    } catch (error: any) { setCreateError(error.response?.data?.detail || "CSV处理失败"); }
    finally { setCreating(false); }
  }

  async function downloadCsvTemplate() {
    try {
      const response = await api.get("/bridge/projects/template.csv", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "gaomei_wes_project_template.csv"; anchor.click();
      URL.revokeObjectURL(url);
    } catch { setCreateError("CSV模板下载失败，请重新登录后重试"); }
  }

  async function runProject(project: BridgeProject) {
    if (!window.confirm(`确认提交 ${project.project_code} 的新一轮WES分析？`)) return;
    try {
      await api.post(`/bridge/projects/${project.id}/run/`, { parameters: {} });
      await refreshProjects();
    } catch (error: any) { window.alert(error.response?.data?.detail || "提交失败"); }
  }

  return (
    <div className="portal-page">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-logo"><img className="brand-mark-img" src="/assets/images/logo_mark.png" alt="高美基因" /><span><b>Gomics</b><small>高美协作平台</small></span></Link>
        <nav>
          <a className="active" href="#overview"><i className="fas fa-th-large" />工作台</a>
          <a href="#projects"><i className="fas fa-vials" />项目中心</a>
          {canOperate && <Link to="/patient-reports"><i className="fas fa-file-medical" />患者正式报告</Link>}
          {canOperate && <Link to="/cloud-jobs"><i className="fas fa-code-branch" />云端任务</Link>}
          {canOperate && <a href="#review"><i className="fas fa-clipboard-check" />审核发布</a>}
          <Link to="/browser"><i className="fas fa-dna" />IGV 证据</Link>
          <a href="#reports"><i className="fas fa-file-medical-alt" />报告中心</a>
          {role === "admin" && <a href="#users"><i className="fas fa-users-cog" />用户与权限</a>}
          <a href="#audit"><i className="fas fa-shield-alt" />操作审计</a>
        </nav>
        <div className="node-card"><span><i className="fas fa-circle" /> node9 桥接服务</span><b>node9-wes-executor</b><small>状态以项目同步结果为准</small></div>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar">
          <div><h1>上午好，{user?.username || "Gomics 用户"}</h1><p>{roleLabel}工作台 · 2026年7月23日</p></div>
          <div className="portal-top-actions">
            {user?.is_staff && <select value={role} onChange={(e) => setRolePreview(e.target.value as PortalRole)} aria-label="预览角色"><option value="admin">管理员视图</option><option value="analyst">分析员视图</option><option value="reviewer">审核员视图</option><option value="client">客户视图</option></select>}
            <button aria-label="通知"><i className="fas fa-bell" /><b>3</b></button><div className="portal-avatar">{(user?.username || "G").slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <section className="portal-content" id="overview">
          <div className="portal-welcome">
            <div><span className="eyebrow">CLINICAL GENOMICS WORKSPACE</span><h2>{role === "client" ? "您的检测进度与报告" : `${bridgeProjects.filter((p) => ["pending", "analyst_review", "admin_review"].includes(p.status)).length} 项工作等待处理`}</h2><p>{role === "client" ? "查看关联项目、正式报告和已发布的变异证据。" : "这里仅展示 node9 同步回传的真实项目、任务和报告。"}</p></div>
            {canOperate && <button className="button button-primary" onClick={() => setShowCreate(true)}><i className="fas fa-plus" /> 创建配对项目</button>}
          </div>

          <div className="metric-grid">
            {[
              ["待审核", role === "client" ? "-" : `${bridgeProjects.filter((p) => ["pending", "analyst_review", "admin_review"].includes(p.status)).length}`, "fa-clipboard-check", "soft-orange"],
              ["运行中", role === "client" ? "-" : `${bridgeProjects.filter((p) => p.status === "running").length}`, "fa-spinner", "soft-blue"],
              ["同步项目", role === "client" ? "-" : `${bridgeProjects.length}`, "fa-check-circle", "soft-green"],
              ["已发布报告", `${reports.length}`, "fa-file-medical", "soft-purple"],
            ].map(([label, value, icon, tone]) => <article className={`metric-card ${tone}`} key={label}><div><span>{label}</span><strong>{loading && label === "已发布报告" ? "…" : value}</strong></div><i className={`fas ${icon}`} /></article>)}
          </div>

          <div className="portal-panel" id="projects">
            <div className="panel-head"><div><h2>病例与样本项目</h2><p>肿瘤-正常配对模式 · GRCh38</p></div><div className="project-search"><i className="fas fa-search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索患者、样本编号或项目编号" /></div></div>
            <div className="table-wrap"><table className="project-table"><thead><tr><th>项目 / 患者</th><th>肿瘤样本</th><th>正常样本</th><th>当前阶段</th><th>进度</th><th>操作</th></tr></thead><tbody>
              {projects.map((project) => { const tumor = project.samples.find((s) => s.role === "tumor"); const normal = project.samples.find((s) => s.role === "normal"); const progress = project.latest_job?.progress_percent || 0; return <tr key={project.id}><td><b>{project.project_code}</b><small>{project.patient_name} · {project.patient_no}</small></td><td>{tumor?.sample_id || "-"}</td><td>{normal?.sample_id || "-"}</td><td><span className={`status-pill ${project.sync_status === "synced" ? "green" : project.sync_status === "failed" ? "orange" : "blue"}`}>{project.sync_status_label} · {project.status_label}</span></td><td><div className="progress-cell"><span><i style={{ width: `${progress}%` }} /></span><b>{progress}%</b></div></td><td><div className="row-actions"><button className="icon-action" disabled={project.sync_status !== "synced"} onClick={() => runProject(project)} title="提交新分析"><i className="fas fa-play" /></button>{project.latest_job && <Link className="icon-action" to="/cloud-jobs" title="查看任务日志"><i className="fas fa-terminal" /></Link>}</div></td></tr>; })}
              {!projects.length && <tr><td colSpan={6}><div className="empty-state">暂无已同步项目</div></td></tr>}
            </tbody></table></div>
          </div>

          <div className="portal-lower-grid">
            <section className="portal-panel" id="analysis">
              <div className="panel-head"><div><h2>{role === "client" ? "最近报告" : "分析流水线"}</h2><p>{role === "client" ? "报告链接默认有效期 30 天" : "WES 配对分析 · 本地节点执行"}</p></div><Link to="/browser">查看 IGV</Link></div>
              {role === "client" ? (reports.length ? <div className="report-preview"><i className="fas fa-file-pdf" /><div><b>{reports[0].title}</b><span>{reports[0].report_number}</span></div><Link className="button button-small button-outline" to={`/reports/${reports[0].id}`}>查看报告</Link></div> : <div className="empty-state">尚无已发布报告</div>) :
              <div className="pipeline-list">{bridgeProjects.filter((p) => p.latest_job).slice(0, 4).map((project) => <div key={project.id}><span className={`pipeline-dot ${project.latest_job?.status === "succeeded" ? "done" : ["running", "claimed"].includes(project.latest_job?.status || "") ? "running" : ""}`} /><div><b>{project.project_code}</b><small>{project.latest_job?.status_label}</small></div><div className="mini-progress"><i style={{ width: `${project.latest_job?.progress_percent || 0}%` }} /></div></div>)}{!bridgeProjects.some((p) => p.latest_job) && <div className="empty-state">暂无运行任务</div>}</div>}
            </section>
            <section className="portal-panel" id="review">
              <div className="panel-head"><div><h2>{role === "client" ? "访问记录" : "审核队列"}</h2><p>安全审计与发布控制</p></div></div>
              <div className="activity-list">
                {(role === "client" ? reports.slice(0, 3).map((report) => [report.title, report.report_number, "blue"]) : bridgeProjects.slice(0, 3).map((project) => [`${project.patient_name} · ${project.project_code}`, `${project.sync_status_label} · ${project.status_label}`, project.sync_status === "synced" ? "green" : "orange"])).map(([title, time, tone]) => <div key={`${title}-${time}`}><span className={`activity-icon ${tone}`}><i className="fas fa-circle" /></span><div><b>{title}</b><small>{time}</small></div></div>)}
                {(role === "client" ? reports.length === 0 : bridgeProjects.length === 0) && <div className="empty-state">暂无记录</div>}
              </div>
            </section>
          </div>

          {role !== "client" && <section className="analyst-group">
            <div><span className="eyebrow dark">BIOINFORMATICS GROUP</span><h2>生信分析人员工作区</h2><p>参数模板、流程版本、运行日志与问题协作集中管理。</p></div>
            <div className="analyst-members">{[["WL", "王琳", "分析负责人"], ["ZY", "张宇", "流程开发"], ["LC", "李晨", "变异审核"], ["+3", "其他成员", "在线协作"]].map(([avatar, name, job]) => <div key={name}><span>{avatar}</span><b>{name}</b><small>{job}</small></div>)}</div>
            <button className="button button-ghost">进入工作区 <i className="fas fa-arrow-right" /></button>
          </section>}
        </section>
        {showCreate && <div className="portal-modal-backdrop"><div className="portal-modal cloud-project-modal">
          <div className="panel-head"><div><h2>创建肿瘤-正常配对项目</h2><p>仅提交node9本地路径，不上传FASTQ</p></div><button className="icon-action" onClick={() => setShowCreate(false)}><i className="fas fa-times" /></button></div>
          <div className="create-mode-tabs"><button className={createMode === "single" ? "active" : ""} onClick={() => setCreateMode("single")}>单个创建</button><button className={createMode === "csv" ? "active" : ""} onClick={() => setCreateMode("csv")}>CSV批量创建</button></div>
          {createError && <div className="cloud-create-error">{createError}</div>}
          {createMode === "single" ? <form className="cloud-project-form" onSubmit={createProject}><div className="form-grid">
            <label>项目编号<input required value={projectForm.project_code} onChange={(e) => setProjectForm({ ...projectForm, project_code: e.target.value })} /></label><label>项目名称<input required value={projectForm.project_name} onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })} /></label>
            <label>患者编号<input required value={projectForm.patient_no} onChange={(e) => setProjectForm({ ...projectForm, patient_no: e.target.value })} /></label><label>患者姓名<input required value={projectForm.patient_name} onChange={(e) => setProjectForm({ ...projectForm, patient_name: e.target.value })} /></label>
            <label>正常样本编号<input required value={projectForm.normal_sample_id} onChange={(e) => setProjectForm({ ...projectForm, normal_sample_id: e.target.value })} /></label><label>正常FASTQ目录<input required value={projectForm.normal_fastq_dir} onChange={(e) => setProjectForm({ ...projectForm, normal_fastq_dir: e.target.value })} /></label>
            <label>肿瘤样本编号<input required value={projectForm.tumor_sample_id} onChange={(e) => setProjectForm({ ...projectForm, tumor_sample_id: e.target.value })} /></label><label>肿瘤FASTQ目录<input required value={projectForm.tumor_fastq_dir} onChange={(e) => setProjectForm({ ...projectForm, tumor_fastq_dir: e.target.value })} /></label>
            <label>参考Profile<input value={projectForm.reference_profile} onChange={(e) => setProjectForm({ ...projectForm, reference_profile: e.target.value })} /></label><label>接收时间<input type="datetime-local" value={projectForm.received_at} onChange={(e) => setProjectForm({ ...projectForm, received_at: e.target.value })} /></label>
          </div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>取消</button><button className="button button-primary" disabled={creating}>{creating ? "等待node9确认..." : "创建项目"}</button></div></form> : <div className="cloud-project-form csv-cloud-panel"><button className="button button-outline" onClick={downloadCsvTemplate}><i className="fas fa-download" /> 下载示例CSV</button><label className="csv-file-picker"><span>选择CSV文件</span><input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} /><b>{csvFile?.name || "尚未选择文件"}</b></label>{csvResult && <div className="csv-result"><b>共 {csvResult.total} 行，成功 {csvResult.success}，失败 {csvResult.failed}</b>{csvResult.items.map((item: any) => <p className={item.status} key={`${item.row}-${item.project_code}`}><span>第{item.row}行 · {item.project_code || "未填写"}</span><em>{item.error || (item.status === "valid" ? "校验通过" : "已提交创建")}</em></p>)}</div>}<div className="modal-actions"><button disabled={creating} onClick={() => importCsv(true)}>仅校验</button><button className="button button-primary" disabled={creating} onClick={() => importCsv(false)}>确认批量创建</button></div></div>}
        </div></div>}
      </main>
    </div>
  );
};

export default Dashboard;
