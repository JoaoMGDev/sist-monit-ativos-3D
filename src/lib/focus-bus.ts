/**
 * Canal para centralizar a câmera num ativo.
 * O listener devolve true quando a sala atual consumiu o pedido.
 * Se ninguém consumir (ainda estamos noutra sala, ou a tela de destino não montou),
 * o id fica pendente para o próximo assinante — sem reentrar no listener atual.
 */
type Listener = (assetId: string) => boolean;

const listeners = new Set<Listener>();
let pendente: string | null = null;

export const focusBus = {
  request(assetId: string) {
    pendente = assetId;
    for (const l of [...listeners]) {
      if (l(assetId)) {
        pendente = null;
        return;
      }
    }
  },
  subscribe(l: Listener) {
    listeners.add(l);
    if (pendente) {
      const id = pendente;
      setTimeout(() => {
        if (pendente === id && l(id)) pendente = null;
      }, 80);
    }
    return () => {
      listeners.delete(l);
    };
  },
};
