import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth";
import { useRouter } from "next/router";
import { randomBytes } from "crypto";

// Material-UI imports
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Card,
  CardContent,
  CardActions,
  TextField,
  Button,
  LinearProgress,
  Box,
  Alert,
  Chip,
  Avatar,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  useTheme,
  alpha,
  InputAdornment
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Cancel as CancelIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Upload as UploadIcon
} from '@mui/icons-material';

// All API calls will go through Next.js API routes (server-side only)
const API_BASE = "/api";
const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB
const MULTIPART_THRESHOLD = 128 * 1024 * 1024; // 128 MB

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const isAuthed = !!user?.token;

  useEffect(() => {
    if (!isAuthed) router.push("/login");
  }, [isAuthed, router]);

  const [keyId, setKeyId] = useState("your-key-id");
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [chunkSizeMB, setChunkSizeMB] = useState(64);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    const key = keyId;

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
        const savedKey = saved?.key_id;
        const savedFileName = saved?.file_name;
        const savedFileSize = saved?.file_size ? Number(saved.file_size) : undefined;
        const savedChunkSize = saved?.chunk_size ? Number(saved.chunk_size) : undefined;
        if (savedKey !== keyId || savedFileName !== f.name || savedFileSize !== f.size || savedChunkSize !== chunkSizeBytes) {
          addLog("Local upload state does not match current key, file, size, or chunk size. Starting new upload.");
          removeLocalUpload(fingerprint);
          upload_id = null;
        }
      }    
      if (upload_id) {
      addLog(`Found local upload id ${upload_id}, checking server status...`);
      const statusRes = await fetch(`${API_BASE}/upload/multipart/status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ upload_id, key_id: keyId }),
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
          key_id: keyId,
          file_size: f.size,
          chunk_size: chunkSizeBytes,
          user_id: user?.username,
          org_id: randomBytes(8).toString("hex"),
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
        key_id: keyId,
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
        body: JSON.stringify({ file_name: f.name, upload_id, part_number: partNumber, key_id: keyId }),
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
          body: JSON.stringify({ file_name: f.name, upload_id, part_number: partNumber, etag, key_id: keyId }),
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
      body: JSON.stringify({ file_name: f.name, upload_id, parts, key_id: keyId }),
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
      setIsUploading(true);
      setUploadSuccess(false);
      setUploadError(null);
      setProgress(0);
      const chunkSizeBytes = chunkSizeMB * 1024 * 1024;
      if (file.size < Math.max(MULTIPART_THRESHOLD, chunkSizeBytes * 2)) {
        await uploadSingle(file);
      } else {
        await multipartUpload(file);
      }
      setUploadSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      addLog(`Error: ${msg}`);
    } finally {
      setIsUploading(false);
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
            body: JSON.stringify({ file_name: file.name, upload_id: saved.upload_id, key_id: keyId }),
          });
          removeLocalUpload(fingerprint);
          addLog("Server-side multipart aborted and local state removed.");
        } catch {
          addLog("Warning: failed to abort server-side upload");
        }
      }
    }
    setProgress(null);
    setIsUploading(false);
    setUploadError(null);
    setUploadSuccess(false);
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUploadThresholdInfo = () => {
    const chunkSizeBytes = chunkSizeMB * 1024 * 1024;
    const threshold = Math.max(MULTIPART_THRESHOLD, chunkSizeBytes * 2);
    return formatFileSize(threshold);
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={0} sx={{
        bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.main',
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
      }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <CloudUploadIcon sx={{ mr: 2, fontSize: 28 }} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              File Upload Portal
            </Typography>
          </Box>

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                avatar={<Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}><PersonIcon /></Avatar>}
                label={user.username}
                variant="outlined"
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.3)',
                  '& .MuiChip-avatar': { color: 'white' }
                }}
              />
              <IconButton
                color="inherit"
                onClick={() => {
                  logout();
                  addLog("User logged out");
                }}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <LogoutIcon />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          mb: 3
        }}>
          {/* Upload Configuration Card */}
          <Box>
            <Card elevation={2} sx={{ height: 'fit-content' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <UploadIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Typography variant="h6" component="h2">
                    Upload Configuration
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Key ID"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    variant="outlined"
                    helperText="Unique identifier for your upload"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <StorageIcon sx={{ color: 'action.active' }} />
                          </InputAdornment>
                        )
                      }
                    }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Chunk Size (MB)"
                    value={chunkSizeMB}
                    onChange={(e) => setChunkSizeMB(Math.max(1, parseInt(e.target.value) || 64))}
                    variant="outlined"
                    slotProps={{
                      htmlInput: { min: 1, max: 1024 },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SpeedIcon sx={{ color: 'action.active' }} />
                          </InputAdornment>
                        )
                      }
                    }}
                    helperText={`Files larger than ${getUploadThresholdInfo()} will use multipart upload`}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    fullWidth
                    startIcon={<DescriptionIcon />}
                    sx={{
                      py: 2,
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      '&:hover': { borderStyle: 'dashed', borderWidth: 2 }
                    }}
                  >
                    {file ? `Selected: ${file.name}` : 'Choose File to Upload'}
                    <input
                      type="file"
                      hidden
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0] || null;
                        setFile(selectedFile);
                        if (selectedFile) {
                          addLog(`File selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
                        }
                      }}
                    />
                  </Button>
                  {file && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>File:</strong> {file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Size:</strong> {formatFileSize(file.size)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Type:</strong> {file.type || 'Unknown'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Status Alerts */}
                {uploadSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
                    Upload completed successfully!
                  </Alert>
                )}

                {uploadError && (
                  <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorIcon />}>
                    Upload failed: {uploadError}
                  </Alert>
                )}

                {/* Progress */}
                {progress !== null && (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body2" color="text.secondary">
                        Upload Progress: {progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 8,
                        borderRadius: 5,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 5,
                          bgcolor: theme.palette.primary.main
                        }
                      }}
                    />
                  </Box>
                )}
              </CardContent>

              <CardActions sx={{ px: 3, pb: 3 }}>
                <Button
                  variant="contained"
                  startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  fullWidth
                  size="large"
                  sx={{ mr: 1 }}
                >
                  {isUploading ? 'Uploading...' : 'Start Upload'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  disabled={!isUploading}
                  color="error"
                >
                  Cancel
                </Button>
              </CardActions>
            </Card>
          </Box>

          {/* Logs Card */}
          <Box>
            <Card elevation={2} sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <InfoIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" component="h2">
                      Upload Logs
                    </Typography>
                  </Box>
                  <Chip
                    label={`${logs.length} entries`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </CardContent>

              <Divider />

              <CardContent sx={{ flexGrow: 1, pt: 2, overflow: 'hidden' }}>
                <Paper
                  variant="outlined"
                  sx={{
                    height: '100%',
                    p: 2,
                    overflow: 'auto',
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
                  }}
                >
                  <List dense>
                    {logs.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No logs yet..."
                          secondary="Upload activity will appear here"
                          sx={{ textAlign: 'center', color: 'text.secondary' }}
                        />
                      </ListItem>
                    ) : (
                      logs.map((log, index) => (
                        <ListItem key={index} divider={index < logs.length - 1}>
                          <ListItemText
                            primary={log}
                            sx={{
                              '& .MuiListItemText-primary': {
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                                wordBreak: 'break-all'
                              }
                            }}
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </Paper>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Info Card */}
        <Card elevation={1} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🚀 Upload Information
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2
            }}>
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  <strong>Single Upload:</strong> Files under {getUploadThresholdInfo()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  <strong>Multipart Upload:</strong> Files over {getUploadThresholdInfo()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  <strong>Chunk Size:</strong> {chunkSizeMB}MB per chunk
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
