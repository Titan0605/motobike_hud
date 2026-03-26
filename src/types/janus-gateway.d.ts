declare module "janus-gateway/npm/dist/janus.es.js" {
  export interface JanusJsep {
    type: RTCSdpType;
    sdp: string;
  }

  export interface JanusMessage {
    result?: Record<string, unknown>;
    error?: string;
    [key: string]: unknown;
  }

  export interface JanusPluginHandle {
    send: (args: { message: Record<string, unknown>; jsep?: JanusJsep }) => void;
    createAnswer: (args: { jsep: JanusJsep; media?: Record<string, unknown>; success: (jsep: JanusJsep) => void; error: (error: unknown) => void }) => void;
    hangup: () => void;
    detach: () => void;
  }

  export interface JanusAttachOptions {
    plugin: string;
    success: (pluginHandle: JanusPluginHandle) => void;
    error: (error: unknown) => void;
    onmessage: (msg: JanusMessage, jsep?: JanusJsep) => void;
    onremotestream?: (stream: MediaStream) => void;
    onremotetrack?: (track: MediaStreamTrack, mid: string, on: boolean) => void;
    iceState?: (state: string) => void;
    webrtcState?: (isUp: boolean) => void;
    oncleanup?: () => void;
  }

  export interface JanusInstance {
    attach: (options: JanusAttachOptions) => void;
    destroy: () => void;
  }

  export interface JanusInitOptions {
    debug?: boolean | string[];
    callback: () => void;
  }

  export interface JanusConstructorOptions {
    server: string;
    success: () => void;
    error: (error: unknown) => void;
    destroyed?: () => void;
  }

  export default class Janus {
    constructor(options: JanusConstructorOptions);
    static init: (options: JanusInitOptions) => void;
    static isWebrtcSupported: () => boolean;
    attach: JanusInstance["attach"];
    destroy: JanusInstance["destroy"];
  }
}
