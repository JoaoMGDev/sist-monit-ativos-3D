/** Canal simples para pedir centralização de câmera a partir de outro componente. */
type Listener = (assetId: string) => void;

const listeners = new Set<Listener>();
let pendente: string | null = null;

export const focusBus = {
  request(assetId: string) {
    if (listeners.size === 0) {
      pendente = assetId;
      return;
    }
    listeners.forEach((l) => l(assetId));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    if (pendente) {
      const id = pendente;
      pendente = null;
      setTimeout(() => l(id), 60);
    }
    return () => {
      listeners.delete(l);
    };
  },
};
