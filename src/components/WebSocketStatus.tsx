import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  useTheme,
  alpha,
  Badge
} from '@mui/material';
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudUpload as CloudUploadIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useUploadWebSocket } from '@/hooks/useUploadWebSocket';

interface WebSocketStatusProps {
  uploadId: string | null;
  userId: string | null;
  token: string | null;
  onStatusUpdate?: (status: any) => void;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  uploadId,
  userId,
  token,
  onStatusUpdate
}) => {
  const theme = useTheme();
  const { status, isConnected, error, connectionHistory, requestStatus, disconnect, reconnect } =
    useUploadWebSocket(uploadId, userId, token);

  React.useEffect(() => {
    if (status && onStatusUpdate) {
      onStatusUpdate(status);
    }
  }, [status, onStatusUpdate]);

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number | undefined) => {
    if (!bytesPerSecond) return '0 B/s';
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const formatETA = (seconds: number | undefined) => {
    if (!seconds) return 'Unknown';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const getStatusColor = (uploadStatus: string) => {
    switch (uploadStatus?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'paused':
        return 'warning';
      case 'uploading':
      case 'processing':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (uploadStatus: string) => {
    switch (uploadStatus?.toLowerCase()) {
      case 'completed':
      case 'success':
        return <CheckCircleIcon />;
      case 'failed':
      case 'error':
        return <ErrorIcon />;
      case 'paused':
        return <PauseIcon />;
      case 'uploading':
        return <CloudUploadIcon />;
      case 'processing':
        return <TimelineIcon />;
      default:
        return <InfoIcon />;
    }
  };

  if (!uploadId || !userId || !token) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <WifiOffIcon sx={{ mr: 2, color: 'text.secondary' }} />
            <Typography variant="h6" color="text.secondary">
              Real-time Status Monitor
            </Typography>
          </Box>
          <Alert severity="info" icon={<InfoIcon />}>
            WebSocket monitoring will be available once an upload is started
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header with Connection Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Badge
              color={isConnected ? 'success' : 'error'}
              variant="dot"
              sx={{ mr: 2 }}
            >
              {isConnected ? <WifiIcon color="success" /> : <WifiOffIcon color="error" />}
            </Badge>
            <Typography variant="h6">
              Real-time Status Monitor
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Status">
              <IconButton
                onClick={requestStatus}
                disabled={!isConnected}
                size="small"
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={isConnected ? "Disconnect" : "Reconnect"}>
              <IconButton
                onClick={isConnected ? disconnect : reconnect}
                size="small"
                color={isConnected ? "error" : "success"}
              >
                {isConnected ? <StopIcon /> : <PlayArrowIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Connection Status */}
        <Box sx={{ mb: 3 }}>
          <Chip
            icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
            size="small"
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Upload Status */}
        {status && (
          <Box sx={{ mb: 3 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.02),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
              }}
            >
              {/* File Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    📁 {status.filename}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={getStatusIcon(status.upload_status)}
                      label={status.upload_status || 'Unknown'}
                      color={getStatusColor(status.upload_status) as any}
                      size="small"
                    />
                    <Chip
                      label={status.processing_status || 'Unknown'}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                </Box>
              </Box>

              {/* Progress Bar */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {status.progress_percent}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={status.progress_percent}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
                    }
                  }}
                />
              </Box>

              {/* Stats Grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 2,
                mb: 2
              }}>
                {status.upload_speed && (
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <SpeedIcon sx={{ color: 'primary.main', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">Speed</Typography>
                    <Typography variant="h6">{formatSpeed(status.upload_speed)}</Typography>
                  </Box>
                )}

                {status.eta_seconds && (
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <ScheduleIcon sx={{ color: 'warning.main', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">ETA</Typography>
                    <Typography variant="h6">{formatETA(status.eta_seconds)}</Typography>
                  </Box>
                )}

                {status.bytes_uploaded && status.total_bytes && (
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <StorageIcon sx={{ color: 'info.main', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">Size</Typography>
                    <Typography variant="h6">
                      {formatFileSize(status.bytes_uploaded)} / {formatFileSize(status.total_bytes)}
                    </Typography>
                  </Box>
                )}

                {status.current_part && status.total_parts && (
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <TimelineIcon sx={{ color: 'success.main', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">Parts</Typography>
                    <Typography variant="h6">
                      {status.current_part} / {status.total_parts}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Server Message */}
              {status.server_message && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {status.server_message}
                </Alert>
              )}

              {/* Error Message */}
              {status.error_message && (
                <Alert severity="error">
                  <strong>Error {status.error_code}:</strong> {status.error_message}
                </Alert>
              )}
            </Paper>
          </Box>
        )}

        {/* Connection History */}
        {connectionHistory.length > 0 && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <InfoIcon sx={{ mr: 1, fontSize: 18 }} />
              Connection History ({connectionHistory.length})
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                maxHeight: 200,
                overflow: 'auto',
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
              }}
            >
              <List dense>
                {connectionHistory.slice(0, 10).map((log, index) => (
                  <ListItem key={index} divider={index < Math.min(connectionHistory.length, 10) - 1}>
                    <ListItemText
                      primary={log}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          lineHeight: 1.4
                        }
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
