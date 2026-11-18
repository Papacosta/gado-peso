/**
 * Evita perder trabalho não salvo (ex.: fotos ainda não gravadas) ao trocar
 * de tela ou fechar o app. A tela registra uma mensagem enquanto houver algo
 * pendente; o roteador pergunta antes de sair.
 */
let message: string | null = null;

export function setUnsavedWork(msg: string | null): void {
  message = msg;
}

export function unsavedWork(): string | null {
  return message;
}

window.addEventListener("beforeunload", (e) => {
  if (message) {
    e.preventDefault();
    e.returnValue = message;
  }
});
