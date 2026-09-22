// Parche de bitrate de video en el SDP (paridad con feature/websocket_imp).
// Algunas cámaras/RPi negocian bitrate muy bajo si el answer no declara b=AS/b=TIAS.
import { STREAM_OPTIONS } from "../config/channels";

const applyBitrateToVideoSection = (section: string, bitrateKbps: number): string => {
  if (bitrateKbps <= 0) {
    return section;
  }

  const lines = section.split("\n");
  const hasBandwidthLine = lines.some((line) => line.startsWith("b=AS:") || line.startsWith("b=TIAS:"));
  if (hasBandwidthLine) {
    return section;
  }

  const insertionIndex = lines.findIndex((line) => line.startsWith("c="));
  if (insertionIndex === -1) {
    return section;
  }

  const bandwidthBitsPerSecond = bitrateKbps * 1000;
  lines.splice(insertionIndex + 1, 0, `b=AS:${bitrateKbps}`, `b=TIAS:${bandwidthBitsPerSecond}`);
  return lines.join("\n");
};

export const patchAnswerSdpWithVideoBitrate = (
  sdp: string,
  bitrateKbps = STREAM_OPTIONS.SDP_VIDEO_BITRATE_KBPS,
): string => {
  if (!STREAM_OPTIONS.FORCE_SDP_VIDEO_BITRATE || bitrateKbps <= 0) {
    return sdp;
  }

  const sections = sdp.split(/\r?\nm=/);
  if (sections.length <= 1) {
    return sdp;
  }

  const patchedSections = sections.map((section, index) => {
    if (index === 0) {
      return section;
    }

    const sectionWithPrefix = `m=${section}`;
    if (!sectionWithPrefix.startsWith("m=video")) {
      return sectionWithPrefix;
    }

    const lines = sectionWithPrefix.split(/\r?\n/);
    const head = lines.shift() ?? "";
    const patchedBody = applyBitrateToVideoSection(lines.join("\n"), bitrateKbps);
    return [head, patchedBody].filter(Boolean).join("\n");
  });

  return patchedSections.map((section, index) => (index === 0 ? section : `\n${section}`)).join("");
};

/** Resume los codecs de la sección m=video de un SDP: "H264/90000 (pt 96)". Solo diagnóstico. */
export const summarizeVideoCodecs = (sdp: string): string => {
  const lines = sdp.split(/\r?\n/);
  const videoIdx = lines.findIndex((line) => line.startsWith("m=video"));
  if (videoIdx === -1) return "sin m=video";
  const payloadTypes = lines[videoIdx].split(" ").slice(3);
  if (payloadTypes.length === 0 || (payloadTypes.length === 1 && payloadTypes[0] === "0")) {
    return "m=video rechazado (puerto 0)";
  }
  const rtpmaps = new Map<string, string>();
  for (const line of lines) {
    const match = line.match(/^a=rtpmap:(\d+)\s+(\S+)/);
    if (match) rtpmaps.set(match[1], match[2]);
  }
  return payloadTypes.map((pt) => `${rtpmaps.get(pt) ?? "?"} (pt ${pt})`).join(", ");
};
