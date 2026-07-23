import type { SQLiteDatabase } from 'expo-sqlite';

import { updateItem } from '@/db/items';

describe('updateItem', () => {
  test('persists roomId so an item can move between rooms', async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const database = { runAsync } as unknown as SQLiteDatabase;

    await updateItem(database, 42, {
      roomId: 9,
      name: 'Blender',
      brand: 'Acme',
      model: 'X100',
      categoryId: 2,
      purchasePriceUsd: 49.5,
      purchaseDate: '2020-01-01',
      description: 'Red',
      localImagePath: null,
    });

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, ...params] = runAsync.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toMatch(/room_id\s*=\s*\?/i);
    expect(params[0]).toBe(9);
    expect(params[params.length - 1]).toBe(42);
  });
});
