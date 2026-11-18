"""Sessão por cookie: assinatura, expiração e troca de senha."""
from app.services import auth


def test_token_valido(monkeypatch):
    monkeypatch.setenv("APP_USER", "gado")
    monkeypatch.setenv("APP_PASSWORD", "segredo123")
    token = auth.make_token(now=1_000_000)
    assert auth.verify_token(token, now=1_000_100)


def test_token_alterado_e_rejeitado(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "segredo123")
    token = auth.make_token(now=1_000_000)
    adulterado = token[:-1] + ("0" if token[-1] != "0" else "1")
    assert not auth.verify_token(adulterado, now=1_000_100)
    assert not auth.verify_token(None)
    assert not auth.verify_token("lixo")


def test_trocar_senha_derruba_sessoes(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "antiga")
    token = auth.make_token(now=1_000_000)
    monkeypatch.setenv("APP_PASSWORD", "nova")
    assert not auth.verify_token(token, now=1_000_100)


def test_sessao_expira(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "segredo123")
    token = auth.make_token(now=0)
    assert not auth.verify_token(token, now=auth.SESSION_MAX_AGE + 10)


def test_credenciais(monkeypatch):
    monkeypatch.setenv("APP_USER", "gado")
    monkeypatch.setenv("APP_PASSWORD", "segredo123")
    assert auth.check_credentials("gado", "segredo123")
    assert auth.check_credentials(" gado ", "segredo123")
    assert not auth.check_credentials("gado", "errada")
    assert not auth.check_credentials("outro", "segredo123")


def test_sem_senha_libera(monkeypatch):
    monkeypatch.delenv("APP_PASSWORD", raising=False)
    assert auth.verify_token(None)
