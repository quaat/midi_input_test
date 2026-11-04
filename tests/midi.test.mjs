import test from 'node:test';
import assert from 'node:assert/strict';
import { noteName, parseMessage } from '../site/midi.js';

test('names notes with middle C = C4 across the MIDI range', () => {
  assert.deepEqual([0, 60, 61, 127].map(noteName), ['C-1', 'C4', 'C♯4', 'G9']);
});
test('decodes channel, velocity, and raw bytes', () => {
  assert.deepEqual(parseMessage(new Uint8Array([0x9f, 60, 127])), {
    type: 'Note on', channel: 16, note: 60, velocity: 127,
    detail: 'C4 · 60 · velocity 127', raw: '9F 3C 7F',
  });
});
test('zero velocity note-on is treated as note-off', () => {
  assert.equal(parseMessage([0x90, 60, 0]).type, 'Note off');
  assert.equal(parseMessage([0x80, 60, 30]).type, 'Note off');
});
test('decodes controller, program, pressure, and pitch bend messages', () => {
  assert.equal(parseMessage([0xb1, 64, 127]).detail, 'CC 64 · value 127');
  assert.equal(parseMessage([0xc0, 0]).detail, 'Program 1');
  assert.equal(parseMessage([0xd0, 50]).detail, 'Pressure 50');
  assert.equal(parseMessage([0xa0, 60, 50]).detail, 'C4 · pressure 50');
  for (const [data, value] of [[[0xe0, 0, 0], -8192], [[0xe0, 0, 64], 0], [[0xe0, 127, 127], 8191]]) {
    assert.equal(parseMessage(data).detail, `Bend ${value}`);
  }
});
test('realtime messages have no channel', () => {
  assert.equal(parseMessage([0xf8]).type, 'Clock');
  assert.equal(parseMessage([0xff]).channel, null);
});
test('ignores incomplete and invalid messages', () => {
  for (const data of [[], [60], [0x90], [0x90, 60], [0xc0]]) assert.equal(parseMessage(data), null);
});
