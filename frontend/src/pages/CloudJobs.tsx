import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import "./cloud-jobs.css";

type CloudJob = {
  id: string;
  job_type: string;
  job_type_label: string;
  status: string;
  status_label: string;
  assigned_node: string;
  progress_percent: number;
  progress_step: string;
  message: string;
  result: Record<string, unknown>;
  payload?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type LogChunk = { sequence: number; stream: string; message: string; created_at: string };

const terminal = new Set(["succeeded", "failed", "canceled"]);

const CloudJobs: React.FC = () => {
  const [jobs, setJobs] = useState<CloudJob[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [logs, setLogs] = useState<LogChunk[]>([]);
  const [duration, setDuration] = useState(6);
  const [label, setLabel] = useState("手工桥接烟测");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [follow, setFollow] = useState(true);
  const [unseenLogs, setUnseenLogs] = useState(0);
  const terminalRef = useRef<HTMLPreElement>(null);
  const previousLogCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/bridge/jobs/");
      setJobs(response.data);
      setError("");
      if (!selectedId && response.data.length) setSelectedId(response.data[0].id);
    } catch {
      setError("无法读取云端任务，请确认内部账号权限。 ");
    }
  }, [selectedId]);

  const loadLogs = useCallback(async () => {
    if (!selectedId) return;
    try {
      const response = await api.get(`/bridge/jobs/${selectedId}/logs/`);
      setLogs(response.data.chunks);
    } catch {
      setLogs([]);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => {
    const timer = window.setInterval(() => { load(); loadLogs(); }, 2000);
    return () => window.clearInterval(timer);
  }, [load, loadLogs]);

  useEffect(() => {
    const added = Math.max(0, logs.length - previousLogCount.current);
    previousLogCount.current = logs.length;
    if (!added) return;
    if (follow) {
      window.requestAnimationFrame(() => {
        if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        setUnseenLogs(0);
      });
    } else {
      setUnseenLogs((value) => value + added);
    }
  }, [logs, follow]);

  function onTerminalScroll() {
    const element = terminalRef.current;
    if (!element || !follow) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight > 80) setFollow(false);
  }

  function resumeFollowing() {
    setFollow(true);
    setUnseenLogs(0);
    window.requestAnimationFrame(() => {
      if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    });
  }

  const selected = jobs.find((job) => job.id === selectedId);

  async function createJob(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.post("/bridge/jobs/", {
        job_type: "smoke",
        node_id: "node9-wes-executor",
        payload: { duration_seconds: duration, label },
      });
      setSelectedId(response.data.id);
      await load();
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || "任务创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob() {
    if (!selected) return;
    await api.post(`/bridge/jobs/${selected.id}/cancel/`);
    await load();
  }

  return (
    <div className="cloud-job-page">
      <aside>
        <Link to="/dashboard" className="cloud-job-brand"><i className="fas fa-dna" /><span><b>Gomics</b><small>云端任务控制</small></span></Link>
        <nav><Link to="/dashboard"><i className="fas fa-th-large" />工作台</Link><span className="active"><i className="fas fa-terminal" />云端任务</span><span><i className="fas fa-stream" />实时日志</span></nav>
        <div><span className="cloud-node-dot" />node9-wes-executor<b>出站 HTTPS</b><small>不开放内网入站端口</small></div>
      </aside>
      <main>
        <header><div><span>PHASE 2 · CLOUD BRIDGE</span><h1>云端任务与实时日志</h1><p>云端排队，node9 主动领取；当前只启用安全烟测白名单。</p></div><Link to="/dashboard">返回工作台</Link></header>
        {error && <div className="cloud-job-error">{error}</div>}
        <section className="cloud-job-grid" id="jobs">
          <form onSubmit={createJob}>
            <span>新建任务</span><h2>桥接安全烟测</h2>
            <label>任务说明<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={100} /></label>
            <label>运行时间（秒）<input type="number" min={1} max={30} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
            <dl><div><dt>执行节点</dt><dd>node9-wes-executor</dd></div><div><dt>命令权限</dt><dd>无任意Shell</dd></div><div><dt>数据传输</dt><dd>仅状态与日志</dd></div></dl>
            <button disabled={busy} type="submit"><i className="fas fa-play" />{busy ? "正在提交" : "提交到 node9"}</button>
          </form>
          <section className="cloud-job-list">
            <div><span>最近任务</span><small>每 2 秒刷新</small></div>
            {jobs.map((job) => <button type="button" className={job.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(job.id)} key={job.id}>
              <i className={`fas ${job.status === "succeeded" ? "fa-check" : job.status === "failed" ? "fa-times" : "fa-wave-square"}`} />
              <span><b>{job.job_type_label} · {String(job.payload?.label || "")}</b><small>{job.id} · {new Date(job.created_at).toLocaleString()}</small></span>
              <em className={`status-${job.status}`}>{job.status_label}</em>
            </button>)}
            {!jobs.length && <p>暂无云端任务。</p>}
          </section>
        </section>
        {selected && <section className="cloud-job-detail" id="logs">
          <div className="cloud-job-progress"><div><span>{selected.assigned_node}</span><h2>{selected.status_label} · {selected.progress_step || "等待"}</h2><p>{selected.message || "任务等待 node9 领取"}</p></div><strong>{selected.progress_percent}%</strong><i><em style={{ width: `${selected.progress_percent}%` }} /></i>{!terminal.has(selected.status) && <button type="button" onClick={cancelJob}>请求取消</button>}</div>
          <div className="cloud-job-terminal">
            <header><span><i />实时日志</span><label><input type="checkbox" checked={follow} onChange={(event) => event.target.checked ? resumeFollowing() : setFollow(false)} /> 跟随最新日志</label><small>{logs.length} chunks</small></header>
            <pre ref={terminalRef} onScroll={onTerminalScroll}>{logs.map((chunk) => `${String(chunk.sequence).padStart(4, "0")}  [${chunk.stream}]  ${chunk.message}`).join("\n") || "等待 node9 回传日志..."}</pre>
            {!follow && unseenLogs > 0 && <button className="cloud-new-log" type="button" onClick={resumeFollowing}><i className="fas fa-arrow-down" /> {unseenLogs} 条新日志</button>}
          </div>
          {!!Object.keys(selected.result || {}).length && <div className="cloud-job-result"><span>结构化结果</span><pre>{JSON.stringify(selected.result, null, 2)}</pre></div>}
        </section>}
      </main>
    </div>
  );
};

export default CloudJobs;
