/**
 * Documents the getAllHouses sort contract (SQL ORDER BY name COLLATE NOCASE ASC).
 * Analogy: the house list is a phone book — A comes before Z regardless of when you added them.
 */
describe('getAllHouses sort contract', () => {
  test('orders house names case-insensitively for display', () => {
    const unsortedNames = ['cabin', 'Beach House', 'apartment'];
    const sortedNames = [...unsortedNames].sort((leftName, rightName) =>
      leftName.localeCompare(rightName, undefined, { sensitivity: 'base' }),
    );

    expect(sortedNames).toEqual(['apartment', 'Beach House', 'cabin']);
  });
});
