import {
  pickDriveFolderId,
  pickGasWebAppUrl,
  pingGas,
  checkDuplicates,
} from '@/lib/gasClient';

describe('pickGasWebAppUrl', () => {
  test('prefers non-empty settings over env', () => {
    expect(
      pickGasWebAppUrl(
        'https://script.google.com/macros/s/from-settings/exec',
        'https://script.google.com/macros/s/from-env/exec',
      ),
    ).toBe('https://script.google.com/macros/s/from-settings/exec');
  });

  test('falls back to env when settings are empty', () => {
    expect(
      pickGasWebAppUrl('  ', 'https://script.google.com/macros/s/from-env/exec'),
    ).toBe('https://script.google.com/macros/s/from-env/exec');
  });

  test('returns null when both missing', () => {
    expect(pickGasWebAppUrl(null, undefined)).toBeNull();
    expect(pickGasWebAppUrl('', '')).toBeNull();
  });
});

describe('pickDriveFolderId', () => {
  test('prefers settings over env', () => {
    expect(pickDriveFolderId('folder-from-settings', 'folder-from-env')).toBe(
      'folder-from-settings',
    );
  });

  test('falls back to env', () => {
    expect(pickDriveFolderId(null, 'folder-from-env')).toBe('folder-from-env');
  });
});

describe('pingGas', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns ping JSON on success', async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            action: 'ping',
            message: 'reachable',
          }),
      } as Response),
    );

    const result = await pingGas('https://example.test/exec');

    expect(result.ok).toBe(true);
    expect(result.action).toBe('ping');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/exec?action=ping',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('throws a clear error when response is not JSON', async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '<html>login</html>',
      } as Response),
    );

    await expect(pingGas('https://example.test/exec')).rejects.toThrow(/did not return JSON/i);
  });

  test('throws gateway error message when ok is false', async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: false,
            error: 'DRIVE_FOLDER_ID is missing',
          }),
      } as Response),
    );

    await expect(pingGas('https://example.test/exec')).rejects.toThrow(
      'DRIVE_FOLDER_ID is missing',
    );
  });
});

describe('checkDuplicates', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('POSTs JSON body and returns duplicates list', async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            action: 'checkDuplicates',
            duplicates: [
              {
                clientItemId: 1,
                sheetRowId: 'abc',
                houseName: 'Home',
                roomName: 'Kitchen',
                name: 'Blender',
                sheetRowNumber: 2,
              },
            ],
          }),
      } as Response),
    );

    const result = await checkDuplicates('https://example.test/exec', []);

    expect(result.duplicates).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/exec',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      }),
    );
  });
});
