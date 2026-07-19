import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, NewCategoryInput } from '@/types/inventory';

type CategoryRow = {
  id: number;
  name: string;
};

/**
 * Converts a database row into the camelCase Category type.
 */
function mapCategoryRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
  };
}

/**
 * Creates a global category (shared across houses).
 */
export async function createCategory(
  database: SQLiteDatabase,
  input: NewCategoryInput,
): Promise<Category> {
  const result = await database.runAsync(
    `INSERT INTO categories (name) VALUES (?)`,
    input.name.trim(),
  );

  const createdCategory = await getCategoryById(database, result.lastInsertRowId);

  if (createdCategory === null) {
    throw new Error('Failed to load category after insert.');
  }

  return createdCategory;
}

/**
 * Returns all categories alphabetically (Feature 8 list).
 */
export async function getAllCategories(database: SQLiteDatabase): Promise<Category[]> {
  const rows = await database.getAllAsync<CategoryRow>(
    `SELECT id, name
     FROM categories
     ORDER BY name COLLATE NOCASE ASC`,
  );

  return rows.map(mapCategoryRowToCategory);
}

/**
 * Loads one category by id, or null if missing.
 */
export async function getCategoryById(
  database: SQLiteDatabase,
  categoryId: number,
): Promise<Category | null> {
  const row = await database.getFirstAsync<CategoryRow>(
    `SELECT id, name
     FROM categories
     WHERE id = ?`,
    categoryId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapCategoryRowToCategory(row);
}

/**
 * Renames a category (Feature 8 edit).
 */
export async function updateCategoryName(
  database: SQLiteDatabase,
  categoryId: number,
  name: string,
): Promise<void> {
  await database.runAsync(
    `UPDATE categories SET name = ? WHERE id = ?`,
    name.trim(),
    categoryId,
  );
}

/**
 * Deletes a category. Items keep their rows; category_id becomes NULL.
 */
export async function deleteCategory(
  database: SQLiteDatabase,
  categoryId: number,
): Promise<void> {
  await database.runAsync(`DELETE FROM categories WHERE id = ?`, categoryId);
}
