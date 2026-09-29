# M16: Optimized multi-stage build with pinned base images.
# Build stage — static binary, stripped symbols, no CGO.
FROM golang:1.23.8-alpine3.21 AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

# Cache dependency downloads separately from source copy.
COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

ARG TARGETOS=linux
ARG TARGETARCH=arm64
ARG VERSION=dev

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" \
    -o api-server ./cmd/api

# Runtime stage — minimal Alpine with only CA certs and timezone data.
FROM alpine:3.21.3

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /build/api-server .

USER appuser

EXPOSE 4001

ENTRYPOINT ["./api-server"]