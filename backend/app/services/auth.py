"""Sessão de login por cookie (substitui o HTTP Basic Auth do nginx).

Por quê: no iPhone, o app salvo na tela inicial não mostra a janela de senha
do Basic Auth e fica com a tela preta. Com uma tela de login própria e um
cookie de sessão, funciona no navegador e no app instalado.

O token é "usuário.emitido_em.assinatura" (HMAC-SHA256). A chave deriva da
senha do app: trocar APP_PASSWORD encerra todas as sessões abertas.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time

COOKIE_NAME = "pv_session"
# Tempo máximo de uma sessão (o produtor não deve precisar logar toda hora).
SESSION_MAX_AGE = 400 * 24 * 3600


def app_user() -> str:
    return os.getenv("APP_USER", "gado")


def app_password() -> str:
    return os.getenv("APP_PASSWORD", "")


def auth_enabled() -> bool:
    return bool(app_password())


def _key() -> bytes:
    secret = os.getenv("SESSION_SECRET", "")
    return hashlib.sha256(f"pesovivo-session|{secret}|{app_password()}".encode()).digest()


def _sign(payload: str) -> str:
    return hmac.new(_key(), payload.encode(), hashlib.sha256).hexdigest()


def check_credentials(user: str, password: str) -> bool:
    if not auth_enabled():
        return True
    ok_user = hmac.compare_digest(user.strip().encode(), app_user().encode())
    ok_pass = hmac.compare_digest(password.encode(), app_password().encode())
    return ok_user and ok_pass


def make_token(now: float | None = None) -> str:
    issued = int(now if now is not None else time.time())
    payload = f"{app_user()}.{issued}"
    return f"{payload}.{_sign(payload)}"


def verify_token(token: str | None, now: float | None = None) -> bool:
    if not auth_enabled():
        return True
    if not token or token.count(".") < 2:
        return False
    payload, _, signature = token.rpartition(".")
    if not hmac.compare_digest(signature, _sign(payload)):
        return False
    user, _, issued = payload.rpartition(".")
    if user != app_user() or not issued.isdigit():
        return False
    age = (now if now is not None else time.time()) - int(issued)
    return 0 <= age <= SESSION_MAX_AGE
