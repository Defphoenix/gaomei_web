import React, { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import PortalSidebar from "../components/PortalSidebar";

type InboxItem = {
  id: number;
  name: string;
  phone: string;
  category: string;
  category_label: string;
  product: string;
  content: string;
  status: "new" | "read" | "done";
  status_label: string;
  admin_note: string;
  created_at: string;
};

type Stats = { total: number; new: number; read: number; done: number };

const ContactMessagesAdmin: React.FC = () => {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "read" | "done">("all");
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const [listRes, statsRes] = await Promise.all([
        api.get(`/company/messages/inbox/${q}`),
        api.get("/company/messages/stats/"),
      ]);
      setItems(listRes.data || []);
      setStats(statsRes.data);
    } catch {
      setError("无法加载留言，请确认已以管理员登录。");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setNote(selected?.admin_note || "");
  }, [selected]);

  const patch = async (id: number, body: Partial<InboxItem>) => {
    const res = await api.patch(`/company/messages/${id}/`, body);
    const updated = res.data as InboxItem;
    setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
    setSelected(updated);
    const statsRes = await api.get("/company/messages/stats/");
    setStats(statsRes.data);
  };

  return (
    <div className="portal-page">
      <PortalSidebar />
      <main className="portal-main">
        <header className="portal-topbar">
          <div>
            <h1>官网留言</h1>
            <p>访客电话咨询留言，可在此查看并标记处理状态</p>
          </div>
          <div className="portal-top-actions">
            <button type="button" className="button button-outline" onClick={() => load()}>刷新</button>
          </div>
        </header>

        <section className="portal-content">
          <div className="metric-grid">
            {[
              ["全部", stats?.total ?? "…", "fa-inbox", "soft-blue"],
              ["未读", stats?.new ?? "…", "fa-envelope", "soft-orange"],
              ["已读", stats?.read ?? "…", "fa-envelope-open", "soft-purple"],
              ["已处理", stats?.done ?? "…", "fa-check-circle", "soft-green"],
            ].map(([label, value, icon, tone]) => (
              <article className={`metric-card ${tone}`} key={label as string}>
                <div><span>{label as string}</span><strong>{value as string | number}</strong></div>
                <i className={`fas ${icon}`} />
              </article>
            ))}
          </div>

          <div className="cm-toolbar">
            {(["all", "new", "read", "done"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={filter === key ? "is-active" : ""}
                onClick={() => setFilter(key)}
              >
                {{ all: "全部", new: "未读", read: "已读", done: "已处理" }[key]}
              </button>
            ))}
          </div>

          {error && <div className="empty-state">{error}</div>}
          {loading && !error && <div className="empty-state">加载中…</div>}

          {!loading && !error && (
            <div className="cm-layout">
              <div className="portal-panel cm-list">
                {items.length === 0 ? (
                  <div className="empty-state">暂无留言</div>
                ) : (
                  items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`cm-row ${selected?.id === item.id ? "is-active" : ""} ${item.status === "new" ? "is-new" : ""}`}
                      onClick={() => {
                        setSelected(item);
                        if (item.status === "new") patch(item.id, { status: "read" } as Partial<InboxItem>).catch(() => undefined);
                      }}
                    >
                      <div>
                        <b>{item.name}</b>
                        <small>{item.phone} · {item.category_label}{item.product ? ` · ${item.product}` : ""}</small>
                      </div>
                      <em>{item.status_label}</em>
                    </button>
                  ))
                )}
              </div>

              <div className="portal-panel cm-detail">
                {!selected ? (
                  <div className="empty-state">选择左侧留言查看详情</div>
                ) : (
                  <>
                    <div className="panel-head">
                      <div>
                        <h2>{selected.name}</h2>
                        <p>{selected.category_label} · {new Date(selected.created_at).toLocaleString("zh-CN")}</p>
                      </div>
                      <a className="button button-primary" href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}>
                        <i className="fas fa-phone" /> 回电
                      </a>
                    </div>
                    <div className="cm-detail-body">
                      <p><strong>联系电话</strong>{selected.phone}</p>
                      {selected.product && <p><strong>产品方向</strong>{selected.product}</p>}
                      <p><strong>留言内容</strong></p>
                      <div className="cm-content">{selected.content}</div>
                      <label>
                        处理备注
                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="内部备注，访客不可见" />
                      </label>
                      <div className="cm-actions">
                        <button type="button" className="button button-outline" onClick={() => patch(selected.id, { status: "read", admin_note: note })}>标为已读</button>
                        <button type="button" className="button button-primary" onClick={() => patch(selected.id, { status: "done", admin_note: note })}>标为已处理</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ContactMessagesAdmin;
