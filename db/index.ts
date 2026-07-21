/**
 * Barrel file: import database helpers from '@/db' in screens later.
 */
export { DATABASE_NAME, getDatabase, initializeDatabase } from '@/db/client';
export { migrateDatabaseIfNeeded, DATABASE_VERSION } from '@/db/migrations';

export {
  createHouse,
  getAllHouses,
  getHouseById,
  updateHouseName,
  deleteHouse,
} from '@/db/houses';

export {
  createRoom,
  getRoomsByHouseId,
  getRoomById,
  updateRoomName,
  deleteRoom,
} from '@/db/rooms';

export {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryName,
  deleteCategory,
} from '@/db/categories';

export {
  createItem,
  getItemsByRoomId,
  getItemById,
  updateItem,
  deleteItem,
  searchItemsInHouse,
  searchItemsInRoom,
  getHouseTotals,
  getExportRowsForHouse,
} from '@/db/items';

export {
  createItemImage,
  getImagesByItemId,
  getItemImageById,
  syncItemPrimaryImageColumns,
  updateItemImagePaths,
  deleteItemImage,
} from '@/db/itemImages';

export { getAppSettings, updateAppSettings } from '@/db/settings';

export {
  getPoliciesByHouseId,
  getPolicyCountForHouse,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from '@/db/insurancePolicies';
