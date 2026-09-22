import { useCallback, useEffect, useState } from "react";
import {
  clearLocalOverride,
  defaultChannels,
  persistChannels,
  resolveChannels,
  type ChannelConfig,
  type ChannelId,
  type ChannelsSource,
} from "../config/channels";

interface UseChannelsResult {
  channels: ChannelConfig[];
  source: ChannelsSource;
  apiAvailable: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateChannel: (id: ChannelId, patch: Partial<ChannelConfig>) => void;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
  resetToDefaults: () => void;
}

export const useChannels = (): UseChannelsResult => {
  const [channels, setChannels] = useState<ChannelConfig[]>(() => defaultChannels());
  const [source, setSource] = useState<ChannelsSource>("defaults");
  const [apiAvailable, setApiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveChannels();
      setChannels(resolved.channels);
      setSource(resolved.source);
      setApiAvailable(resolved.apiAvailable);
    } catch (e) {
      setError(`No se pudo cargar la configuración: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de config (fetch): caso de uso canónico de useEffect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const updateChannel = useCallback((id: ChannelId, patch: Partial<ChannelConfig>) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, id } : c)));
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const result = await persistChannels(channels);
      if (result.error) setError(result.error);

      if (result.savedToFile) {
        // Releer del archivo para reflejar exactamente lo persistido (y limpiar overrides locales)
        const resolved = await resolveChannels().catch(() => null);
        if (resolved) {
          setChannels(resolved.channels);
          setSource(resolved.source);
          setApiAvailable(resolved.apiAvailable);
        } else {
          setSource("api");
          setApiAvailable(true);
        }
      } else if (result.usedLocalFallback) {
        setSource("file+local");
      }

      return result.savedToFile;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [channels]);

  const resetToDefaults = useCallback(() => {
    clearLocalOverride();
    setChannels(defaultChannels());
    setError(null);
  }, []);

  return { channels, source, apiAvailable, loading, saving, error, updateChannel, save, reload, resetToDefaults };
};
