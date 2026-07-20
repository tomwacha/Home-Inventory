import {
  pickDriveFolderId,
  pickGasWebAppUrl,
  pingGas,
  checkDuplicates,
  downloadInventory,
  uploadInventory,
  resolveGasConnection,
  getEnvGasDefaults,
} from '@/lib/gasClient';

jest.mock('@/db/settings', () => ({
  getAppSettings: jest.fn(),
}));

import { getAppSettings } from '@/db/settings';

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

  test('returns null when both missing', () => {
    expect(pickDriveFolderId(null, undefined)).toBeNull();
    expect(pickDriveFolderId('  ', '')).toBeNull();
  });
});

describe('resolveGasConnection', () => {
  const previousWebAppUrl = process.env.EXPO_PUBLIC_GAS_WEB_APP_URL;
  const previousFolderId = process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID;

  afterEach(() => {
    process.env.EXPO_PUBLIC_GAS_WEB_APP_URL = previousWebAppUrl;
    process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID = previousFolderId;
    jest.mocked(getAppSettings).mockReset();
  });

  test('uses settings URL and folder id when present', async () => {
    delete process.env.EXPO_PUBLIC_GAS_WEB_APP_URL;
    delete process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID;

    jest.mocked(getAppSettings).mockResolvedValue({
      id: 1,
      gasWebAppUrl: 'https://script.google.com/macros/s/settings/exec',
      defaultDriveFolderId: 'folder-settings',
    });

    const connection = await resolveGasConnection({} as never);

    expect(connection).toEqual({
      webAppUrl: 'https://script.google.com/macros/s/settings/exec',
      driveFolderId: 'folder-settings',
    });
  });

  test('throws a Settings hint when no URL is configured', async () => {
    delete process.env.EXPO_PUBLIC_GAS_WEB_APP_URL;
    jest.mocked(getAppSettings).mockResolvedValue({
      id: 1,
      gasWebAppUrl: null,
      defaultDriveFolderId: null,
    });

    await expect(resolveGasConnection({} as never)).rejects.toThrow(/Open Settings/i);
  });
});

describe('getEnvGasDefaults', () => {
  const previousWebAppUrl = process.env.EXPO_PUBLIC_GAS_WEB_APP_URL;
  const previousFolderId = process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID;

  afterEach(() => {
    process.env.EXPO_PUBLIC_GAS_WEB_APP_URL = previousWebAppUrl;
    process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID = previousFolderId;
  });

  test('returns trimmed env values or empty strings', () => {
    process.env.EXPO_PUBLIC_GAS_WEB_APP_URL = '  https://example.test/exec  ';
    process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID = ' folder-1 ';

    expect(getEnvGasDefaults()).toEqual({
      webAppUrl: 'https://example.test/exec',
      driveFolderId: 'folder-1',
    });
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

describe('downloadInventory', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('requests download with an encoded houseName filter', async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            action: 'download',
            items: [],
          }),
      } as Response),
    );

    const result = await downloadInventory(
      'https://example.test/exec',
      'Beach House',
    );

    expect(result.items).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/exec?action=download&houseName=Beach%20House',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('uploadInventory', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('POSTs upload action with duplicateMode and driveFolderId', async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            action: 'upload',
            results: [
              {
                clientItemId: 1,
                sheetRowId: 'new-id',
                driveImageUrl: null,
                status: 'created',
              },
            ],
          }),
      } as Response),
    );

    const result = await uploadInventory(
      'https://example.test/exec',
      [],
      'skip',
      'folder-xyz',
    );

    expect(result.results).toHaveLength(1);

    const fetchCall = jest.mocked(global.fetch).mock.calls[0];
    const requestInit = fetchCall[1] as RequestInit;
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(parsedBody).toEqual({
      action: 'upload',
      driveFolderId: 'folder-xyz',
      duplicateMode: 'skip',
      items: [],
    });
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
