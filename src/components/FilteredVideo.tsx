import { useEffect, useRef } from "react";

// Portado de la rama feature/websocket_imp (conocido-funcional, incluido Safari).
// Decodifica el MediaStream en un <video> fuera del DOM y lo pinta por WebGL en un <canvas>.
// Safari tiene problemas renderizando WebRTC directo en <video>; este camino sí funciona.

type FilteredVideoProps = {
  stream: MediaStream | null;
  className?: string;
  enableFilters?: boolean;
  saturate?: number;
  contrast?: number;
  brightness?: number;
  sharpen?: boolean;
  onStats?: (stats: { fps: number; frames: number }) => void;
  onVideoElement?: (video: HTMLVideoElement | null) => void;
};

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_video;
uniform vec2 u_texelSize;
uniform float u_saturate;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_sharpen;
uniform float u_enableFilters;

varying vec2 v_uv;

vec3 adjustColor(vec3 color) {
  if (u_enableFilters < 0.5) {
    return color;
  }

  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luminance), color, u_saturate);
  color = (color - 0.5) * u_contrast + 0.5;
  color *= u_brightness;
  return clamp(color, 0.0, 1.0);
}

vec3 sharpenColor(vec2 uv) {
  vec3 center = texture2D(u_video, uv).rgb;
  if (u_sharpen <= 0.0) {
    return center;
  }

  vec3 north = texture2D(u_video, uv + vec2(0.0, -u_texelSize.y)).rgb;
  vec3 south = texture2D(u_video, uv + vec2(0.0, u_texelSize.y)).rgb;
  vec3 west = texture2D(u_video, uv + vec2(-u_texelSize.x, 0.0)).rgb;
  vec3 east = texture2D(u_video, uv + vec2(u_texelSize.x, 0.0)).rgb;

  vec3 sharpened = center * (1.0 + 4.0 * u_sharpen) - (north + south + west + east) * u_sharpen;
  return clamp(sharpened, 0.0, 1.0);
}

void main() {
  vec3 color = sharpenColor(v_uv);
  color = adjustColor(color);
  gl_FragColor = vec4(color, 1.0);
}
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (gl: WebGLRenderingContext): WebGLProgram | null => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

export const FilteredVideo = ({
  stream,
  className,
  enableFilters = false,
  saturate = 1.06,
  contrast = 1.04,
  brightness = 1,
  sharpen = false,
  onStats,
  onVideoElement,
}: FilteredVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoFrameCallbackRef = useRef<number | null>(null);
  const framesRenderedRef = useRef(0);
  const framesThisSecondRef = useRef(0);
  const lastFpsMarkRef = useRef(0);
  const onStatsRef = useRef(onStats);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute("muted", "");
    videoRef.current = video;
    onVideoElement?.(video);
    return () => {
      video.srcObject = null;
      onVideoElement?.(null);
      videoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    if (stream) {
      const result = video.play() as Promise<void> | undefined;
      result?.catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const program = createProgram(gl);
    if (!program) return;

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const videoUniformLocation = gl.getUniformLocation(program, "u_video");
    const texelSizeLocation = gl.getUniformLocation(program, "u_texelSize");
    const saturateLocation = gl.getUniformLocation(program, "u_saturate");
    const contrastLocation = gl.getUniformLocation(program, "u_contrast");
    const brightnessLocation = gl.getUniformLocation(program, "u_brightness");
    const sharpenLocation = gl.getUniformLocation(program, "u_sharpen");
    const enableFiltersLocation = gl.getUniformLocation(program, "u_enableFilters");

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture || !videoUniformLocation || !texelSizeLocation || !saturateLocation || !contrastLocation || !brightnessLocation || !sharpenLocation || !enableFiltersLocation) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let stopped = false;
    let lastWidth = 0;
    let lastHeight = 0;
    lastFpsMarkRef.current = performance.now();

    const updateSize = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const updateStats = () => {
      framesRenderedRef.current += 1;
      framesThisSecondRef.current += 1;
      const now = performance.now();
      const elapsed = now - lastFpsMarkRef.current;
      if (elapsed >= 1000) {
        const fps = Math.round((framesThisSecondRef.current * 1000) / elapsed);
        framesThisSecondRef.current = 0;
        lastFpsMarkRef.current = now;
        onStatsRef.current?.({ fps, frames: framesRenderedRef.current });
      }
    };

    const renderFrame = () => {
      if (stopped) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
        rafRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      updateSize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } catch {
        rafRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      gl.uniform1i(videoUniformLocation, 0);
      gl.uniform2f(texelSizeLocation, 1 / Math.max(video.videoWidth, 1), 1 / Math.max(video.videoHeight, 1));
      gl.uniform1f(saturateLocation, saturate);
      gl.uniform1f(contrastLocation, contrast);
      gl.uniform1f(brightnessLocation, brightness);
      gl.uniform1f(sharpenLocation, sharpen ? 1 : 0);
      gl.uniform1f(enableFiltersLocation, enableFilters ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      updateStats();
    };

    const handleVideoReady = () => {
      updateSize();
      renderFrame();
    };

    const videoWithCallbacks = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };

    if (typeof videoWithCallbacks.requestVideoFrameCallback === "function") {
      const requestFrame = () => {
        if (stopped) return;
        renderFrame();
        videoFrameCallbackRef.current = videoWithCallbacks.requestVideoFrameCallback?.(requestFrame) ?? null;
      };
      video.addEventListener("loadedmetadata", handleVideoReady);
      videoFrameCallbackRef.current = videoWithCallbacks.requestVideoFrameCallback(requestFrame);
    } else {
      video.addEventListener("loadedmetadata", handleVideoReady);
      const loop = () => {
        if (stopped) return;
        renderFrame();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      stopped = true;
      video.removeEventListener("loadedmetadata", handleVideoReady);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoFrameCallbackRef.current && typeof videoWithCallbacks.cancelVideoFrameCallback === "function") {
        videoWithCallbacks.cancelVideoFrameCallback(videoFrameCallbackRef.current);
      }
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [stream, enableFilters, saturate, contrast, brightness, sharpen]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas ref={canvasRef} className={className} />
    </div>
  );
};

export default FilteredVideo;
