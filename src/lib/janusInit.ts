import Janus from "janus-gateway/npm/dist/janus.es.js";
import adapter from "webrtc-adapter";

type JanusWithDependencies = {
  init: (options: { debug: boolean; callback: () => void; dependencies?: unknown }) => void;
  useDefaultDependencies: (deps?: { adapter?: unknown }) => unknown;
};

const janusWithDeps = Janus as unknown as JanusWithDependencies;

let initPromise: Promise<void> | null = null;

/** Inicializa Janus una sola vez para toda la app (singleton). */
export const ensureJanusInit = (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = new Promise<void>((resolve) => {
    janusWithDeps.init({
      debug: false,
      dependencies: janusWithDeps.useDefaultDependencies({ adapter }),
      callback: () => resolve(),
    });
  });
  return initPromise;
};

export const isWebrtcSupported = (): boolean => Janus.isWebrtcSupported();

export { Janus };
