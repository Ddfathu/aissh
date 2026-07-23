# Stage 1: Compile Script Golang menjadi Binary Cepat
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY mux.go .
COPY ws-proxy.go .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o mux mux.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ws-proxy ws-proxy.go

# Stage 2: Runner Image Utama Alpine
FROM alpine:3.20

RUN apk update && apk add --no-cache \
    stunnel \
    openssl \
    sudo \
    curl \
    bash \
    openssh-server \
    openssh-client \
    gcompat

# Salin binary Golang hasil compile dari Stage 1
COPY --from=builder /app/mux /usr/local/bin/mux
COPY --from=builder /app/ws-proxy /usr/local/bin/ws-proxy

# Install cloudflared (Argo Tunnel) untuk Linux AMD64
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared

# --- TAMBAHAN UNTUK UDPGW DI ALPINE (TANPA MENGUBAH YANG LAIN) ---
RUN curl -fsSL -o /usr/local/bin/badvpn-udpgw \
    https://github.com/ambrop72/badvpn/releases/download/1.999.130/badvpn-linux-amd64-badvpn-1.999.130.tar.bz2 \
    || curl -fsSL -o /tmp/badvpn.tar.gz https://raw.githubusercontent.com/ganjarprasetio/badvpn-udpgw-alpine/main/badvpn-udpgw \
    && if [ -f /tmp/badvpn.tar.gz ]; then mv /tmp/badvpn.tar.gz /usr/local/bin/badvpn-udpgw; fi \
    && chmod +x /usr/local/bin/badvpn-udpgw
# ----------------------------------------------------------------

RUN mkdir -p /var/run/sshd /var/run/stunnel /etc/stunnel

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
