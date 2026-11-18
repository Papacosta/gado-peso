#!/bin/sh
# Login do app. Com APP_PASSWORD definido, TODO o app e a API exigem login
# (tela /login.html + cookie de sessão conferido no backend).
# Obrigatório quando o app é aberto na internet.
#
# Não usamos mais HTTP Basic Auth: no iPhone, o app salvo na tela inicial não
# mostra a janela de senha e fica com a tela preta.
set -e

AUTH_INC=/etc/nginx/auth.inc
if [ -n "$APP_PASSWORD" ]; then
  cat > "$AUTH_INC" <<CONF
auth_request /_auth;
error_page 401 = @unauth;
CONF
  echo "[auth] login ativado para o usuario '${APP_USER:-gado}'"
else
  echo "# sem senha (APP_PASSWORD vazio)" > "$AUTH_INC"
  echo "[auth] AVISO: app sem senha. Nao exponha na internet."
fi
