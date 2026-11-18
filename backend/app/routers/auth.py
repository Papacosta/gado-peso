"""Login do app: tela própria + cookie (funciona no app da tela inicial do iPhone)."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel

from ..services.auth import (
    COOKIE_NAME,
    SESSION_MAX_AGE,
    auth_enabled,
    check_credentials,
    make_token,
    verify_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    user: str
    password: str


@router.post("/login", status_code=204)
async def login(body: LoginIn, response: Response) -> Response:
    if not check_credentials(body.user, body.password):
        # Atraso fixo: dificulta tentar muitas senhas em sequência.
        await asyncio.sleep(1.5)
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")
    response.set_cookie(
        COOKIE_NAME,
        make_token(),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    response.status_code = 204
    return response


@router.post("/logout", status_code=204)
def logout(response: Response) -> Response:
    response.delete_cookie(COOKIE_NAME, path="/")
    response.status_code = 204
    return response


@router.get("/check", status_code=204)
def check(pv_session: str | None = Cookie(default=None)) -> Response:
    """Usado pelo nginx (auth_request) a cada requisição protegida."""
    if not verify_token(pv_session):
        raise HTTPException(status_code=401, detail="Sessão expirada. Entre novamente.")
    return Response(status_code=204)


@router.get("/status")
def status() -> dict:
    return {"auth_enabled": auth_enabled()}
