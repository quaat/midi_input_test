import { test, expect } from '@playwright/test';

async function mockMidi(page, mode = 'available') {
  await page.addInitScript(mode => {
    const input = { id: 'keys', name: 'Test keys', state: 'connected', onmidimessage: null };
    const other = { id: 'pads', name: 'Test pads', state: 'connected', onmidimessage: null };
    window.midi = { inputs: new Map([['keys', input], ['pads', other]]), onstatechange: null };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: mode === 'unsupported' ? undefined : async options => {
        window.midiOptions = options;
        if (mode === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
        return window.midi;
      }, configurable: true,
    });
  }, mode);
}

async function send(page, data, id = 'keys') {
  await page.evaluate(({ data, id }) => window.midi.inputs.get(id).onmidimessage?.({ data: new Uint8Array(data) }), { data, id });
}

test('loads under the Pages project prefix with no failed assets', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('./');
  await expect(page).toHaveTitle('MIDI Input Lab');
  await expect(page.locator('#keyboard .key')).toHaveCount(49);
  expect(await page.locator('h1').evaluate(el => getComputedStyle(el).fontSize)).not.toBe('32px');
  expect(failures).toEqual([]);
});

test('connects on request and shows incoming notes, velocity and note release', async ({ page }) => {
  await mockMidi(page);
  await page.goto('./');
  expect(await page.evaluate(() => window.midiOptions)).toBeUndefined();
  await page.getByRole('button', { name: 'Connect MIDI' }).click();
  await expect(page.locator('#status')).toContainText('2 MIDI inputs');
  expect(await page.evaluate(() => window.midiOptions)).toEqual({ sysex: false });
  await send(page, [0x92, 60, 99]);
  await expect(page.locator('#last-note')).toHaveText('C4');
  await expect(page.locator('#velocity')).toHaveText('99');
  await expect(page.locator('#channel')).toHaveText('3');
  await expect(page.locator('[data-note="60"]')).toHaveClass('key active');
  await expect(page.locator('#messages tr').first()).toContainText('92 3C 63');
  await send(page, [0x92, 60, 0]);
  await expect(page.locator('#active-count')).toHaveText('0 active notes');
});

test('separates devices and channels and handles device selection and disconnection', async ({ page }) => {
  await mockMidi(page);
  await page.goto('./');
  await page.locator('#connect').click();
  await send(page, [0x90, 60, 90]);
  await send(page, [0x91, 60, 90], 'pads');
  await send(page, [0x80, 60, 0]);
  await expect(page.locator('[data-note="60"]')).toHaveClass('key active');
  await page.locator('#inputs').selectOption('keys');
  await expect(page.locator('#active-count')).toHaveText('0 active notes');
  await send(page, [0x90, 64, 90], 'pads');
  await expect(page.locator('#count')).toHaveText('3');
  await send(page, [0x90, 64, 90]);
  await page.evaluate(() => {
    window.midi.inputs.get('keys').state = 'disconnected';
    window.midi.onstatechange();
  });
  await expect(page.locator('#active-count')).toHaveText('0 active notes');
  await expect(page.locator('#inputs')).toHaveValue('all');
  await expect(page.locator('#status')).toContainText('1 MIDI input');
});

test('clears all notes for controller resets and keeps the live log bounded', async ({ page }) => {
  await mockMidi(page);
  await page.goto('./');
  await page.locator('#connect').click();
  await send(page, [0x90, 60, 99]);
  await send(page, [0xb0, 123, 0]);
  await expect(page.locator('#active-count')).toHaveText('0 active notes');
  await page.evaluate(() => {
    for (let i = 0; i < 110; i++) window.midi.inputs.get('keys').onmidimessage({ data: [0xb0, 1, i % 128] });
  });
  await expect(page.locator('#messages tr')).toHaveCount(100);
  await page.locator('#pause').click();
  await send(page, [0x90, 67, 90]);
  await expect(page.locator('#count')).toHaveText('113');
  await expect(page.locator('#last-note')).toHaveText('G4');
  await expect(page.locator('#messages tr').first()).toContainText('Control change');
  await page.locator('#pause').click();
  await send(page, [0x80, 67, 0]);
  await expect(page.locator('#messages tr').first()).toContainText('Note off');
  await page.locator('#clear').click();
  await expect(page.locator('#messages tr')).toHaveCount(0);
  await expect(page.locator('#count')).toHaveText('0');
  await expect(page.locator('#empty')).toBeVisible();
});

test('reports denied permission and allows retry', async ({ page }) => {
  await mockMidi(page, 'denied');
  await page.goto('./');
  await page.locator('#connect').click();
  await expect(page.locator('#status')).toContainText('access was blocked');
  await expect(page.locator('#connect')).toBeEnabled();
});

test('demo works without Web MIDI and is explicitly labeled as simulated', async ({ page }) => {
  await mockMidi(page, 'unsupported');
  await page.goto('./');
  await expect(page.locator('#connect')).toBeDisabled();
  await expect(page.locator('#status')).toContainText('unavailable');
  await page.locator('#demo').click();
  await expect(page.locator('#count')).toHaveText('8');
  await expect(page.locator('#source')).toHaveText('Demo (simulated)');
  await expect(page.locator('#active-count')).toHaveText('0 active notes');
});

test('detects a controller attached after MIDI permission was granted', async ({ page }) => {
  await mockMidi(page);
  await page.goto('./');
  await page.evaluate(() => { for (const input of window.midi.inputs.values()) input.state = 'disconnected'; });
  await page.locator('#connect').click();
  await expect(page.locator('#status')).toContainText('Connect a controller');
  await expect(page.locator('#inputs')).toBeDisabled();
  await page.evaluate(() => { window.midi.inputs.get('keys').state = 'connected'; window.midi.onstatechange(); });
  await expect(page.locator('#inputs')).toBeEnabled();
  await send(page, [0x90, 60, 99]);
  await expect(page.locator('#last-note')).toHaveText('C4');
});

test('fits a mobile viewport without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await expect(page.locator('#connect')).toBeVisible();
  await expect(page.locator('#demo')).toBeVisible();
});
