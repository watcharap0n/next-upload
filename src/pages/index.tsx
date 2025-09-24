import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth";
import { useRouter } from "next/router";

// All API calls will go through Next.js API routes (server-side only)
const API_BASE = "/api";
const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB
const MULTIPART_THRESHOLD = 128 * 1024 * 1024; // 128 MB

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const isAuthed = !!user?.token;

  useEffect(() => {
    if (!isAuthed) router.push("/login");
  }, [isAuthed, router]);

  const [projectId, setProjectId] = useState("project1");
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [chunkSizeMB, setChunkSizeMB] = useState(64);
  const controllerRef = useRef<AbortController | null>(null);

  function addLog(msg: string) {
    setLogs((s) => [new Date().toLocaleTimeString() + " - " + msg, ...s].slice(0, 200));
  }

  const authHeaders = useMemo((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.token) h["Authorization"] = `Bearer ${user.token}`;
    return h;
  }, [user?.token]);

  function fingerprintForFile(f: File) {
    return `${f.name}-${f.size}-${f.lastModified}`;
  }

  function saveLocalUpload(fingerprint: string, data: unknown) {
    try {
      localStorage.setItem(`upload:${fingerprint}`, JSON.stringify(data));
    } catch {
      // Ignore localStorage errors
    }
  }

  function loadLocalUpload(fingerprint: string) {
    try {
      const v = localStorage.getItem(`upload:${fingerprint}`);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }

  function removeLocalUpload(fingerprint: string) {
    try {
      localStorage.removeItem(`upload:${fingerprint}`);
    } catch {
      // Ignore localStorage errors
    }
  }

  async function uploadSingle(f: File) {
    const fileSizeMB = (f.size / (1024 * 1024)).toFixed(2);
    addLog(`📤 Single upload: ${f.name} (${fileSizeMB}MB)`);
    addLog("🔗 Requesting presigned URL for single upload...");
    const key = `data/org1/${projectId}/input`;

    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ file_name: f.name, file_type: f.type || "application/octet-stream", key }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Failed to get upload URL: ${res.status} ${txt}`);
    }
    const { url } = await res.json();

    addLog("⬆️ Uploading file to S3 via presigned URL...");
    controllerRef.current = new AbortController();
    const putRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": f.type || "application/octet-stream" },
      body: f,
      signal: controllerRef.current.signal,
    });
    if (!putRes.ok) {
      const txt = await putRes.text();
      throw new Error(`Upload failed: ${putRes.status} ${txt}`);
    }
    addLog("✅ Single upload completed successfully!");
    setProgress(100);
  }

  async function multipartUpload(f: File) {
    const chunkSizeBytes = chunkSizeMB * 1024 * 1024;
    const fileSizeMB = (f.size / (1024 * 1024)).toFixed(2);
    const totalParts = Math.ceil(f.size / chunkSizeBytes);
    addLog(`🚀 Starting multipart upload: ${f.name} (${fileSizeMB}MB, ${totalParts} chunks of ${chunkSizeMB}MB each)`);
    const fingerprint = fingerprintForFile(f);

    const saved = loadLocalUpload(fingerprint);
    let upload_id: string | null = saved?.upload_id || null;
    let serverParts: Record<string, string> = {};

      if (upload_id) {
        const savedProject = saved?.project_id;
        const savedFileName = saved?.file_name;
        const savedFileSize = saved?.file_size ? Number(saved.file_size) : undefined;
        const savedChunkSize = saved?.chunk_size ? Number(saved.chunk_size) : undefined;
        if (savedProject !== projectId || savedFileName !== f.name || savedFileSize !== f.size || savedChunkSize !== chunkSizeBytes) {
          addLog("Local upload state does not match current project, file, size, or chunk size. Starting new upload.");
          removeLocalUpload(fingerprint);
          upload_id = null;
        }
      }    if (upload_id) {
      addLog(`Found local upload id ${upload_id}, checking server status...`);
      const statusRes = await fetch(`${API_BASE}/upload/multipart/status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ upload_id, project_id: projectId }),
      });
      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        const fileNameMismatch = !!statusJson.file_name && statusJson.file_name !== f.name;
        const fileSizeMismatch = !!statusJson.file_size && Number(statusJson.file_size) !== f.size;
        if (fileNameMismatch || fileSizeMismatch) {
          addLog("Server upload state mismatch. Starting new upload.");
          removeLocalUpload(fingerprint);
          upload_id = null;
        } else {
          serverParts = statusJson.parts || {};
          const uploadedPartsCount = Object.keys(serverParts).length;
          const totalParts = Math.ceil(f.size / CHUNK_SIZE);
          addLog(`📋 Server reported ${uploadedPartsCount}/${totalParts} parts already uploaded`);
        }
      } else {
        addLog("Server status check failed, starting a new upload.");
        upload_id = null;
        removeLocalUpload(fingerprint);
      }
    }

    if (!upload_id) {
      const startRes = await fetch(`${API_BASE}/upload/multipart/start`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          file_name: f.name,
          file_type: f.type || "application/octet-stream",
          project_id: projectId,
          file_size: f.size,
          chunk_size: chunkSizeBytes,
        }),
      });
      if (!startRes.ok) {
        const txt = await startRes.text();
        throw new Error(`Failed to start multipart: ${startRes.status} ${txt}`);
      }
      const startJson = await startRes.json();
      upload_id = startJson.upload_id as string;
      saveLocalUpload(fingerprint, {
        upload_id,
        file_name: f.name,
        file_size: f.size,
        chunk_size: chunkSizeBytes,
        project_id: projectId,
      });
      addLog(`Received upload id: ${upload_id}`);
    }

    const parts: { PartNumber: number; ETag: string }[] = [];

    let uploadedBytes = 0;
    for (const pStr of Object.keys(serverParts)) {
      const pNum = parseInt(pStr, 10);
      const start = (pNum - 1) * chunkSizeBytes;
      const end = Math.min(start + chunkSizeBytes, f.size);
      uploadedBytes += end - start;
      parts.push({ PartNumber: pNum, ETag: serverParts[pStr] });
    }

    controllerRef.current = new AbortController();

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      if (serverParts[String(partNumber)]) {
        const startByte = (partNumber - 1) * chunkSizeBytes;
        const endByte = Math.min(startByte + chunkSizeBytes, f.size);
        const chunkSizeMB = ((endByte - startByte) / (1024 * 1024)).toFixed(2);
        setProgress(Math.round((uploadedBytes / f.size) * 100));
        addLog(`⏭️ Skipping part ${partNumber}/${totalParts} (${chunkSizeMB}MB) - already uploaded`);
        continue;
      }

      const startByte = (partNumber - 1) * chunkSizeBytes;
      const endByte = Math.min(startByte + chunkSizeBytes, f.size);
      const chunk = f.slice(startByte, endByte);

      addLog(`🔗 Requesting presigned URL for part ${partNumber}...`);
      const signRes = await fetch(`${API_BASE}/upload/multipart/upload`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ file_name: f.name, upload_id, part_number: partNumber, project_id: projectId }),
      });
      if (!signRes.ok) {
        const txt = await signRes.text();
        throw new Error(`Failed to sign part ${partNumber}: ${signRes.status} ${txt}`);
      }
      const { url: presignedUrl } = await signRes.json();

      const chunkSizeMB = (chunk.size / (1024 * 1024)).toFixed(2);
      const startByteFormatted = (startByte / (1024 * 1024)).toFixed(2);
      const endByteFormatted = (endByte / (1024 * 1024)).toFixed(2);
      
      addLog(`Uploading part ${partNumber}/${totalParts} (${chunkSizeMB}MB: ${startByteFormatted}MB-${endByteFormatted}MB)...`);
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
        signal: controllerRef.current.signal,
      });
      if (!putRes.ok) {
        const txt = await putRes.text();
        throw new Error(`Failed to upload part ${partNumber}: ${putRes.status} ${txt}`);
      }

      const etag = putRes.headers.get("ETag") || putRes.headers.get("etag") || "";
      parts.push({ PartNumber: partNumber, ETag: etag });
      
      addLog(`✓ Part ${partNumber}/${totalParts} uploaded successfully (${chunkSizeMB}MB, ETag: ${etag.substring(0, 8)}...)`);

      try {
        await fetch(`${API_BASE}/upload/multipart/confirm`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ file_name: f.name, upload_id, part_number: partNumber, etag, project_id: projectId }),
        });
        addLog(`📝 Part ${partNumber} confirmed on server`);
      } catch {
        addLog(`⚠️ Warning: failed to confirm part ${partNumber} to server`);
      }

      uploadedBytes += chunk.size;
      const progressPercent = Math.round((uploadedBytes / f.size) * 100);
      setProgress(progressPercent);
      const totalUploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(2);
      const totalFileMB = (f.size / (1024 * 1024)).toFixed(2);
      addLog(`📊 Progress: ${progressPercent}% (${totalUploadedMB}MB/${totalFileMB}MB)`);
    }

    addLog("Completing multipart upload...");
    const completeRes = await fetch(`${API_BASE}/upload/multipart/complete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ file_name: f.name, upload_id, parts, project_id: projectId }),
    });
    if (!completeRes.ok) {
      const txt = await completeRes.text();
      throw new Error(`Failed to complete multipart: ${completeRes.status} ${txt}`);
    }
    const completeJson = await completeRes.json();
    addLog(`✅ Multipart upload completed successfully! ${completeJson?.message || JSON.stringify(completeJson)}`);
    const finalFileSizeMB = (f.size / (1024 * 1024)).toFixed(2);
    addLog(`🎉 Upload finished: ${f.name} (${finalFileSizeMB}MB) uploaded to AWS S3`);
    setProgress(100);
    removeLocalUpload(fingerprint);
  }

  async function handleUpload() {
    if (!file) return;
    if (!user || !user.token) {
      addLog("Not authenticated. Please sign in first.");
      router.push("/login");
      return;
    }

    try {
      setProgress(0);
      const chunkSizeBytes = chunkSizeMB * 1024 * 1024;
      if (file.size < Math.max(MULTIPART_THRESHOLD, chunkSizeBytes * 2)) await uploadSingle(file);
      else await multipartUpload(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Error: ${msg}`);
    }
  }

  async function handleCancel() {
    controllerRef.current?.abort();
    addLog("Upload canceled by user.");
    if (file) {
      const fingerprint = fingerprintForFile(file);
      const saved = loadLocalUpload(fingerprint);
      if (saved?.upload_id) {
        try {
          await fetch(`${API_BASE}/upload/multipart/abort`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ file_name: file.name, upload_id: saved.upload_id, project_id: projectId }),
          });
          removeLocalUpload(fingerprint);
          addLog("Server-side multipart aborted and local state removed.");
        } catch {
          addLog("Warning: failed to abort server-side upload");
        }
      }
    }
    setProgress(null);
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-6 row-start-2 items-center sm:items-start w-full max-w-2xl">
        <div className="flex items-center gap-3 w-full justify-between">
          <div className="flex items-center gap-3">
            <Image className="dark:invert" src="/next.svg" alt="Next.js logo" width={120} height={26} priority />
            <h1 className="text-xl font-semibold">Upload Demo</h1>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm">{user.username}</div>
                <button
                  onClick={() => {
                    logout();
                    addLog("User logged out");
                  }}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="w-full bg-white/60 dark:bg-black/40 p-6 rounded shadow">
          <label className="block mb-2">Project ID</label>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />

          <label className="block mb-2">Chunk Size (MB)</label>
          <input
            type="number"
            value={chunkSizeMB}
            onChange={(e) => setChunkSizeMB(Math.max(1, parseInt(e.target.value) || 64))}
            min="1"
            max="1024"
            className="w-full p-2 border rounded mb-2"
            placeholder="64"
          />
          <p className="text-sm text-gray-600 mb-4">
            Size of each chunk for multipart upload. Larger chunks = fewer requests but higher memory usage.
          </p>

          <label className="block mb-2">File</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />

          <div className="flex items-center gap-2 mb-4">
            <button onClick={handleUpload} disabled={!file} className="px-4 py-2 bg-blue-600 text-white rounded">
              Upload
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 rounded">
              Cancel
            </button>
            <div className="ml-auto text-sm opacity-70">API: {API_BASE}</div>
          </div>

          {progress !== null && (
            <div className="relative w-full h-6 bg-gray-200 rounded overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-700 text-white text-xs flex items-center justify-center transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              >
                {progress}%
              </div>
            </div>
          )}
        </div>

        <div className="w-full">
          <h2 className="font-medium mb-2">Logs</h2>
          <div className="rounded border p-3 h-56 overflow-auto text-sm bg-white/60 dark:bg-black/40">
            <ul className="space-y-1">
              {logs.map((l, i) => (
                <li key={i} className="font-mono">
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 text-sm">
            <a className="underline" href="https://nextjs.org/learn" target="_blank" rel="noreferrer">
              Learn Next.js
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
