type Listener = () => void;

const listeners: Record<string, Listener[]> = {};

export const EventEmitter = {
  on(event: string, listener: Listener): () => void {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(listener);
    return () => {
      listeners[event] = listeners[event].filter((l) => l !== listener);
    };
  },

  emit(event: string): void {
    if (listeners[event]) {
      listeners[event].forEach((l) => l());
    }
  },
};
