import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  HouseInsurancePolicy,
  NewHouseInsurancePolicyInput,
} from '@/types/inventory';

type HouseInsurancePolicyRow = {
  id: number;
  house_id: number;
  company_name: string;
  company_phone: string | null;
  policy_number: string | null;
  policy_expiration_date: string | null;
  declarations_image_path: string | null;
};

/**
 * Converts a database row into the camelCase HouseInsurancePolicy type.
 */
function mapRowToPolicy(row: HouseInsurancePolicyRow): HouseInsurancePolicy {
  return {
    id: row.id,
    houseId: row.house_id,
    companyName: row.company_name,
    companyPhone: row.company_phone,
    policyNumber: row.policy_number,
    policyExpirationDate: row.policy_expiration_date,
    declarationsImagePath: row.declarations_image_path,
  };
}

/**
 * Lists insurance policies for one house (A–Z by company name).
 */
export async function getPoliciesByHouseId(
  database: SQLiteDatabase,
  houseId: number,
): Promise<HouseInsurancePolicy[]> {
  const rows = await database.getAllAsync<HouseInsurancePolicyRow>(
    `SELECT
      id, house_id, company_name, company_phone,
      policy_number, policy_expiration_date, declarations_image_path
     FROM house_insurance_policies
     WHERE house_id = ?
     ORDER BY company_name COLLATE NOCASE ASC`,
    houseId,
  );

  return rows.map(mapRowToPolicy);
}

/**
 * Counts policies for a house (house main page meta).
 */
export async function getPolicyCountForHouse(
  database: SQLiteDatabase,
  houseId: number,
): Promise<number> {
  const row = await database.getFirstAsync<{ policy_count: number }>(
    `SELECT COUNT(id) AS policy_count
     FROM house_insurance_policies
     WHERE house_id = ?`,
    houseId,
  );

  return row?.policy_count ?? 0;
}

/**
 * Loads one policy by id, or null if missing.
 */
export async function getPolicyById(
  database: SQLiteDatabase,
  policyId: number,
): Promise<HouseInsurancePolicy | null> {
  const row = await database.getFirstAsync<HouseInsurancePolicyRow>(
    `SELECT
      id, house_id, company_name, company_phone,
      policy_number, policy_expiration_date, declarations_image_path
     FROM house_insurance_policies
     WHERE id = ?`,
    policyId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapRowToPolicy(row);
}

/**
 * Creates a policy for a house and returns the new row.
 */
export async function createPolicy(
  database: SQLiteDatabase,
  input: NewHouseInsurancePolicyInput,
): Promise<HouseInsurancePolicy> {
  const result = await database.runAsync(
    `INSERT INTO house_insurance_policies (
      house_id,
      company_name,
      company_phone,
      policy_number,
      policy_expiration_date,
      declarations_image_path
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    input.houseId,
    input.companyName.trim(),
    input.companyPhone ?? null,
    input.policyNumber ?? null,
    input.policyExpirationDate ?? null,
    input.declarationsImagePath ?? null,
  );

  const createdPolicy = await getPolicyById(database, result.lastInsertRowId);

  if (createdPolicy === null) {
    throw new Error('Failed to load policy after insert.');
  }

  return createdPolicy;
}

/**
 * Updates editable policy fields.
 */
export async function updatePolicy(
  database: SQLiteDatabase,
  policyId: number,
  updates: {
    companyName: string;
    companyPhone: string | null;
    policyNumber: string | null;
    policyExpirationDate: string | null;
    declarationsImagePath: string | null;
  },
): Promise<void> {
  await database.runAsync(
    `UPDATE house_insurance_policies SET
      company_name = ?,
      company_phone = ?,
      policy_number = ?,
      policy_expiration_date = ?,
      declarations_image_path = ?
     WHERE id = ?`,
    updates.companyName.trim(),
    updates.companyPhone,
    updates.policyNumber,
    updates.policyExpirationDate,
    updates.declarationsImagePath,
    policyId,
  );
}

/**
 * Deletes one policy row.
 */
export async function deletePolicy(
  database: SQLiteDatabase,
  policyId: number,
): Promise<void> {
  await database.runAsync(
    `DELETE FROM house_insurance_policies WHERE id = ?`,
    policyId,
  );
}
