# Multi-stage build for minimal container size
# Stage 1: Build the Go binary
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app

# Copy Go module files
COPY go.mod ./

# Download dependencies (if any)
RUN go mod download

# Copy source code
COPY server.go ./

# Build the binary with optimizations
# -ldflags="-s -w" strips debug information for smaller binary
# CGO_ENABLED=0 creates a static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ziktok server.go

# Stage 2: Create minimal runtime image
FROM alpine:latest

# Install CA certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Create a non-root user for security
RUN addgroup -g 1001 -S ziktok && \
    adduser -S ziktok -u 1001 -G ziktok

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/ziktok /app/ziktok

# Copy static files
COPY public ./public

# Change ownership to non-root user
RUN chown -R ziktok:ziktok /app

# Switch to non-root user
USER ziktok

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run the binary
CMD ["/app/ziktok"]
