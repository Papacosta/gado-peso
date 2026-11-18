#!/bin/sh
# Senha de acesso ao app (HTTP Basic Auth no nginx).
# Com APP_PASSWORD definido, TODO o app e a API exigem usuário/senha.
# Obrigatório quando o app é aberto na internet (perfil "remoto").
set -e

AUTH_INC=/etc/nginx/auth.inc
if [ -n "$APP_PASSWORD" ]; then
  USER_NAME="${APP_USER:-gado}"
  printf '%s:%s\n' "$USER_NAME" "$(openssl passwd -apr1 "$APP_PASSWORD")" > /etc/nginx/htpasswd
  chmod 640 /etc/nginx/htpasswd
  chown root:nginx /etc/nginx/htpasswd 2>/dev/null || true
  cat > "$AUTH_INC" <<CONF
auth_basic "PesoVivo";
auth_basic_user_file /etc/nginx/htpasswd;
CONF
  echo "[auth] senha de acesso ativada para o usuario '$USER_NAME'"
else
  echo "# sem senha (APP_PASSWORD vazio)" > "$AUTH_INC"
  echo "[auth] AVISO: app sem senha. Nao exponha na internet."
fi
