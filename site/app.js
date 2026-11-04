import { noteName, parseMessage } from './midi.js';

const $ = id => document.getElementById(id);
let access;
let count = 0;
let paused = false;
let selected = 'all';
const held = new Map();
const keys = new Map();
let white = 0;
for (let note = 36; note <= 84; note++) {
  const black = [1, 3, 6, 8, 10].includes(note % 12);
  const key = document.createElement('div');
  key.className = `key${black ? ' black' : ''}`;
  key.dataset.note = note;
  key.setAttribute('aria-label', noteName(note));
  if (black) key.style.left = `calc(${white / 29 * 100}% - 1%)`;
  else { white++; if (note % 12 === 0) key.textContent = noteName(note); }
  $('keyboard').append(key);
  keys.set(note, key);
}

function renderNotes() {
  const active = new Set(held.values());
  for (const [note, key] of keys) key.classList.toggle('active', active.has(note));
  $('active-count').textContent = `${active.size} active note${active.size === 1 ? '' : 's'}`;
}

function receive(data, device, deviceId) {
  const message = parseMessage(data);
  if (!message) return;
  $('count').textContent = ++count;
  $('channel').textContent = message.channel ?? '—';
  $('source').textContent = device;
  const key = `${deviceId}:${message.channel}:${message.note}`;
  if (message.type === 'Note on') {
    held.set(key, message.note);
    $('last-note').textContent = noteName(message.note);
    $('note-number').textContent = `MIDI note ${message.note}`;
    $('velocity').textContent = message.velocity;
    $('velocity-bar').style.width = `${message.velocity / 127 * 100}%`;
  } else if (message.type === 'Note off') held.delete(key);
  else if ((message.type === 'Control change' && [120, 123].includes(message.controller)) || message.type === 'Reset') {
    const prefix = message.type === 'Reset' ? `${deviceId}:` : `${deviceId}:${message.channel}:`;
    for (const id of held.keys()) if (id.startsWith(prefix)) held.delete(id);
  }
  renderNotes();
  if (paused) return;
  $('empty').hidden = true;
  $('table-wrap').hidden = false;
  const row = document.createElement('tr');
  const time = new Date().toISOString().slice(11, 23);
  for (const value of [time, message.type, message.channel ?? '—', message.detail, device, message.raw]) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }
  $('messages').prepend(row);
  while ($('messages').children.length > 100) $('messages').lastElementChild.remove();
}

function refreshInputs() {
  const inputs = [...access.inputs.values()].filter(input => input.state !== 'disconnected');
  if (selected !== 'all' && !inputs.some(input => input.id === selected)) selected = 'all';
  const options = inputs.length ? [['all', 'All MIDI inputs'], ...inputs.map(input => [input.id, input.name || 'Unnamed input'])] : [['all', 'No MIDI inputs found']];
  $('inputs').replaceChildren(...options.map(([value, text]) => new Option(text, value)));
  $('inputs').value = selected;
  $('inputs').disabled = !inputs.length;
  // Drop notes from devices that disconnected or are no longer selected.
  const listening = inputs.filter(input => selected === 'all' || selected === input.id);
  for (const id of held.keys()) if (!listening.some(input => id.startsWith(`${input.id}:`))) held.delete(id);
  renderNotes();
  for (const input of access.inputs.values()) {
    input.onmidimessage = listening.includes(input) ? event => receive(event.data, input.name || 'Unnamed input', input.id) : null;
  }
  $('status').textContent = inputs.length ? `Connected · ${inputs.length} MIDI input${inputs.length === 1 ? '' : 's'} available. Play a note or move a control.` : 'MIDI access granted. Connect a controller; inputs will appear automatically.';
}

$('inputs').addEventListener('change', () => { selected = $('inputs').value; held.clear(); refreshInputs(); });
$('connect').addEventListener('click', async () => {
  $('connect').disabled = true;
  $('status').textContent = 'Waiting for MIDI permission…';
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = refreshInputs;
    refreshInputs();
    $('connect').textContent = 'MIDI connected ✓';
  } catch (error) {
    $('status').textContent = error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'MIDI access was blocked. Allow MIDI in your browser’s site settings, then try again.' : `Could not connect to MIDI. ${error.message || 'Please try again.'}`;
    $('connect').disabled = false;
  }
});

$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume log' : 'Pause log';
  $('pause').setAttribute('aria-pressed', String(paused));
  $('log-state').textContent = paused ? 'Paused · notes and counters are still live' : 'Live · showing the latest 100 messages';
});
$('clear').addEventListener('click', () => {
  $('messages').replaceChildren();
  $('table-wrap').hidden = true;
  $('empty').hidden = false;
  count = 0;
  $('count').textContent = '0';
});
$('demo').addEventListener('click', async () => {
  $('demo').disabled = true;
  // Demo messages use a separate device identity and never request hardware access.
  for (const [note, velocity] of [[60, 92], [64, 76], [67, 110], [72, 100]]) {
    receive([0x90, note, velocity], 'Demo (simulated)', 'demo');
    await new Promise(resolve => setTimeout(resolve, 220));
    receive([0x80, note, 0], 'Demo (simulated)', 'demo');
  }
  $('demo').disabled = false;
});

if (!window.isSecureContext || !navigator.requestMIDIAccess) {
  $('connect').disabled = true;
  $('status').textContent = !window.isSecureContext ? 'MIDI requires HTTPS or localhost. Open the secure version of this page.' : 'Web MIDI is unavailable in this browser. Try Chrome or Edge, or explore the demo below.';
}
