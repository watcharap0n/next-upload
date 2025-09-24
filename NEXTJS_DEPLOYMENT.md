# Next.js Only Docker Deployment

This configuration deploys only the Next.js application as a standalone Docker container, connecting to external API services.

## Quick Start

### 1. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
# Your external API endpoint
NEXT_PUBLIC_API_BASE=https://your-api-domain.com
API_BASE_INTERNAL=https://your-api-domain.com
```

### 2. Deploy Production

```bash
# Build and start the Next.js container
docker-compose up -d

# Check status
docker-compose logs -f nextjs-app
```

### 3. Deploy Development

```bash
# Start development container with hot reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Deployment Options

### Option 1: Basic Next.js Container

```bash
# Just the Next.js application on port 3000
docker-compose up -d nextjs-app
```

Access at: http://localhost:3000

### Option 2: With Nginx Proxy

```bash
# Next.js + Nginx reverse proxy on port 80
docker-compose --profile production up -d
```

Access at: http://localhost (port 80)

### Option 3: Standalone Docker Build

```bash
# Build the image
docker build -t nextjs-upload-app \
  --build-arg NEXT_PUBLIC_API_BASE=https://your-api-domain.com \
  --build-arg API_BASE_INTERNAL=https://your-api-domain.com \
  .

# Run the container
docker run -d \
  --name nextjs-upload-app \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE=https://your-api-domain.com \
  -e API_BASE_INTERNAL=https://your-api-domain.com \
  nextjs-upload-app
```

## Configuration

### Environment Variables

- `NEXT_PUBLIC_API_BASE` - Public API URL for client-side requests
- `API_BASE_INTERNAL` - API URL for server-side requests (usually same as public)
- `NODE_ENV` - Environment mode (production/development)

### External API Requirements

Your external API server should:
1. Be accessible from both browser clients and the Docker container
2. Handle CORS for browser requests from your domain
3. Accept requests from the container's IP range if needed

## Container Details

### Production Container (`docker-compose.yml`)
- **Image**: Multi-stage optimized build
- **Port**: 3000
- **Mode**: Production with standalone output
- **Health Check**: Monitors `/api/hello` endpoint
- **Restart**: Automatic restart on failure

### Development Container (`docker-compose.dev.yml`)
- **Image**: Development build with hot reload
- **Port**: 3000
- **Mode**: Development with file watching
- **Volumes**: Source code mounted for live editing

### Nginx Proxy (Optional)
- **Port**: 80 (HTTP)
- **Features**: Load balancing, SSL termination support
- **Profile**: `production` (use with `--profile production`)

## Commands

```bash
# Start production
docker-compose up -d

# Start development
docker-compose -f docker-compose.dev.yml up -d

# Start with Nginx
docker-compose --profile production up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Rebuild after changes
docker-compose build --no-cache

# Remove all containers and images
docker-compose down --rmi all
```

## Customization

### Adding SSL/HTTPS

1. Place SSL certificates in `./ssl/` directory
2. Uncomment SSL configuration in `nginx.conf`
3. Update the Nginx service volumes in `docker-compose.yml`

### Environment-Specific Builds

```bash
# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs nextjs-app

# Check container status
docker ps -a
```

### API Connection Issues
1. Verify API endpoints are accessible from container
2. Check CORS configuration on API server
3. Ensure environment variables are set correctly

### Port Conflicts
```bash
# Use different port
docker-compose up -d --scale nextjs-app=1 -p 3001:3000
```

## Health Monitoring

The container includes health checks that ping `/api/hello`. Monitor with:

```bash
# Check health status
docker inspect nextjs-upload-app | grep Health -A 10

# View health check logs
docker logs nextjs-upload-app
```

## Performance

This configuration provides:
- ✅ Optimized production builds
- ✅ Minimal container size
- ✅ Fast startup times
- ✅ Automatic restarts
- ✅ Health monitoring
- ✅ Easy scaling and updates