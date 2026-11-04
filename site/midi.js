const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteName = note => `${names[note % 12]}${Math.floor(note / 12) - 1}`;

export function parseMessage(data) {
  if (!data?.length || data[0] < 0x80) return null;
  const [status, a, b] = data;
  const raw = Array.from(data, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  if (status >= 0xf0) {
    const labels = { 0xf0: 'System exclusive', 0xf1: 'Time code', 0xf2: 'Song position', 0xf3: 'Song select', 0xf6: 'Tune request', 0xf8: 'Clock', 0xfa: 'Start', 0xfb: 'Continue', 0xfc: 'Stop', 0xfe: 'Active sensing', 0xff: 'Reset' };
    return { type: labels[status] || 'System', channel: null, detail: 'System message', raw };
  }
  const kind = status >> 4;
  if (data.length < ([0xc, 0xd].includes(kind) ? 2 : 3)) return null;
  const channel = (status & 0xf) + 1;
  const base = { channel, raw };
  switch (kind) {
    case 0x8:
    case 0x9: return { ...base, type: kind === 0x8 || b === 0 ? 'Note off' : 'Note on', note: a, velocity: b, detail: `${noteName(a)} · ${a} · velocity ${b}` };
    case 0xa: return { ...base, type: 'Poly pressure', detail: `${noteName(a)} · pressure ${b}` };
    case 0xb: return { ...base, type: 'Control change', controller: a, value: b, detail: `CC ${a} · value ${b}` };
    case 0xc: return { ...base, type: 'Program change', detail: `Program ${a + 1}` };
    case 0xd: return { ...base, type: 'Channel pressure', detail: `Pressure ${a}` };
    case 0xe: return { ...base, type: 'Pitch bend', detail: `Bend ${((b << 7) | a) - 8192}` };
    default: return null;
  }
}
