# Docker Deployment Instructions

This document explains how to deploy the Next.js upload application using Docker and Docker Compose.

## Environment Configuration

The application is configured to use different API base URLs for client-side and server-side requests:

- **Client-side requests**: Use `NEXT_PUBLIC_API_BASE` (accessible in browser)
- **Server-side requests**: Use `API_BASE_INTERNAL` (for internal Docker communication)

### Environment Files

- `.env.local` - Local development
- `.env.production` - Production deployment
- `.env.example` - Template for environment variables

## Docker Configuration

### Files Overview

- `Dockerfile` - Optimized production build with multi-stage approach
- `Dockerfile.dev` - Development build for local development
- `docker-compose.yml` - Production deployment
- `docker-compose.dev.yml` - Development deployment
- `.dockerignore` - Excludes unnecessary files from Docker context
- `nginx.conf` - Optional Nginx reverse proxy configuration

## Deployment Options

### 1. Production Deployment

```bash
# Build and start production containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### 2. Development Deployment

```bash
# Build and start development containers
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop containers
docker-compose -f docker-compose.dev.yml down
```

### 3. Production with Nginx Proxy

```bash
# Start with Nginx proxy
docker-compose --profile production up -d

# This includes the Nginx reverse proxy on port 80
```

### 4. Build Only Next.js Container

```bash
# Build production image
docker build -t nextjs-upload-app .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE=http://your-api-server:8080 \
  -e API_BASE_INTERNAL=http://your-api-server:8080 \
  nextjs-upload-app
```

## Environment Variables

### Required Variables

- `NEXT_PUBLIC_API_BASE` - Public API URL for client-side requests
- `API_BASE_INTERNAL` - Internal API URL for server-side requests (Docker networking)

### Optional Variables

- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Port for Next.js app (default: 3000)

## API Server Configuration

Replace the placeholder `api-server` service in docker-compose.yml with your actual API server:

```yaml
api-server:
  image: your-actual-api-image:tag
  # or build from source:
  # build:
  #   context: ../path-to-api-server
  #   dockerfile: Dockerfile
  ports:
    - "8080:8080"
  environment:
    - YOUR_API_ENV_VARS=value
```

## Docker Network Communication

The application uses Docker's internal networking:

- **Internal communication**: `http://api-server:8080` (container-to-container)
- **External access**: `http://localhost:8080` (host-to-container)

This allows:
- Client browsers to make requests to external API endpoints
- Server-side Next.js code to communicate internally within Docker network
- Optimal performance and security in containerized environments

## Health Checks

Both containers include health checks:
- Next.js app: `GET /api/hello`
- API server: `GET /health` (customize based on your API)

## Troubleshooting

### Container Communication Issues

1. Ensure containers are on the same network
2. Use container names for internal communication
3. Check environment variables are set correctly

### Build Issues

1. Clear Docker cache: `docker system prune -a`
2. Rebuild without cache: `docker-compose build --no-cache`
3. Check .dockerignore doesn't exclude required files

### Port Conflicts

1. Change port mappings in docker-compose.yml
2. Check no other services are using the same ports
3. Use `docker ps` to see running containers

## Performance Optimization

The production Dockerfile uses:
- Multi-stage build to reduce image size
- Standalone output mode for optimal performance
- Non-root user for security
- Proper layer caching for faster builds

## Security Considerations

- Containers run as non-root user
- Only necessary files are included (via .dockerignore)
- Environment variables for sensitive configuration
- Health checks for container monitoring