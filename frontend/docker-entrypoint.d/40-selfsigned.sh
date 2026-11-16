#!/bin/sh
# Gera certificado autoassinado na primeira subida (câmera/PWA exigem HTTPS).
set -e

CERT_DIR=/etc/nginx/certs
if [ ! -f "$CERT_DIR/cert.pem" ]; then
  mkdir -p "$CERT_DIR"
  IP=$(hostname -i 2>/dev/null | awk '{print $1}')
  [ -z "$IP" ] && IP=127.0.0.1
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/key.pem" \
    -out "$CERT_DIR/cert.pem" \
    -subj "/CN=$IP" \
    -addext "subjectAltName=IP:$IP,IP:127.0.0.1,DNS:localhost" >/dev/null 2>&1
  echo "[selfsigned] certificado criado para $IP"
fi
