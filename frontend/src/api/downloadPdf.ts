import axios from "axios";
import api from "./client";

/**
 * Download formal report PDF with JWT.
 *
 * Prefer /wes/reports/<id>/pdf/ — that path is gated by wes_auth and runs
 * write_pdf (HTML→PDF) when the cache is stale. Do not silently fall through
 * to static /media or asset URLs that bypass generation.
 */
export async function downloadAuthenticatedPdf(url: string, filename: string): Promise<void> {
  if (!url) {
    throw new Error("PDF 链接为空");
  }

  const token = localStorage.getItem("access_token") || "";
  let response;

  if (url.startsWith("/wes/")) {
    // Must NOT go through axios baseURL "/api" (would become /api/wes/... → 404)
    const sep = url.includes("?") ? "&" : "?";
    const withToken = token ? `${url}${sep}access_token=${encodeURIComponent(token)}` : url;
    response = await axios.get(withToken, {
      responseType: "blob",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      // HTML→PDF can take tens of seconds on first generation
      timeout: 120000,
    });
  } else if (url.startsWith("/media/")) {
    throw new Error("拒绝直接下载 /media 静态 PDF；请走 /wes/.../pdf/ 生成接口");
  } else {
    const path = url.startsWith("/api/") ? url.slice(4) : url;
    response = await api.get(path, { responseType: "blob", timeout: 120000 });
  }

  const blob: Blob = response.data;
  const ctype = String(response.headers?.["content-type"] || blob.type || "");
  if (ctype.includes("text/html") || ctype.includes("application/json") || ctype.includes("text/plain")) {
    // Auth redirect / 403 / 503 often come back as HTML/text blobs
    throw new Error("服务器未返回 PDF（可能被鉴权拦截、尚未生成或生成失败）");
  }
  if (blob.size < 1000) {
    throw new Error("PDF 文件异常过小，可能未正确生成");
  }

  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
