FROM alpine:3.20

# 1. Tambahkan gcompat (PENTING: untuk perbaikan bug glibc/musl di Alpine)
RUN apk update && apk add --no-cache \
    stunnel \
    openssl \
    sudo \
    curl \
    bash \
    nodejs \
    npm \
    python3 \
    openssh-server \
    openssh-client \
    gcompat 

# 2. Install cloudflared (Argo Tunnel) untuk Linux AMD64
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    && chmod +x /usr/local/bin/cloudflared

# 3. Create necessary application directories
RUN mkdir -p /var/run/sshd /var/run/stunnel /etc/stunnel

# 4. Copy main entrypoint scripting
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 5. Copy core Javascript Muxer v8.0 (Gunakan versi 8.0 Tank Baja kemarin)
COPY server.js /server.js

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
