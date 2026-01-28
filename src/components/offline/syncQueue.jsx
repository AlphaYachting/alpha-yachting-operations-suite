// Sync queue for managing offline changes
import { offlineStorage } from './offlineStorage';
import { base44 } from '@/api/base44Client';

const QUEUE_STATES = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const addToQueue = async (entity, action, data, entityId) => {
  const queueItem = {
    id: `${entity}_${entityId}_${Date.now()}`,
    entity,
    action,
    data,
    entityId,
    status: QUEUE_STATES.PENDING,
    timestamp: new Date().toISOString(),
    retries: 0
  };

  await offlineStorage.saveData(offlineStorage.STORES.syncQueue, queueItem);
  return queueItem;
};

const getPendingItems = async () => {
  const allItems = await offlineStorage.getAllData(offlineStorage.STORES.syncQueue);
  return allItems.filter(item => item.status === QUEUE_STATES.PENDING);
};

const updateQueueItemStatus = async (id, status) => {
  const item = await offlineStorage.getData(offlineStorage.STORES.syncQueue, id);
  if (item) {
    await offlineStorage.saveData(offlineStorage.STORES.syncQueue, {
      ...item,
      status
    });
  }
};

const processQueue = async (onSync) => {
  const pendingItems = await getPendingItems();
  
  for (const item of pendingItems) {
    try {
      await updateQueueItemStatus(item.id, QUEUE_STATES.SYNCING);

      let result;
      if (item.action === 'create') {
        result = await base44.entities[item.entity].create(item.data);
      } else if (item.action === 'update') {
        result = await base44.entities[item.entity].update(item.entityId, item.data);
      }

      await updateQueueItemStatus(item.id, QUEUE_STATES.COMPLETED);
      
      if (onSync) {
        onSync({
          success: true,
          entity: item.entity,
          action: item.action,
          id: item.id
        });
      }
    } catch (error) {
      await updateQueueItemStatus(item.id, QUEUE_STATES.FAILED);
      
      if (onSync) {
        onSync({
          success: false,
          entity: item.entity,
          action: item.action,
          id: item.id,
          error: error.message
        });
      }
    }
  }
};

const clearCompletedItems = async () => {
  const allItems = await offlineStorage.getAllData(offlineStorage.STORES.syncQueue);
  const completedItems = allItems.filter(item => item.status === QUEUE_STATES.COMPLETED);
  
  for (const item of completedItems) {
    await offlineStorage.deleteData(offlineStorage.STORES.syncQueue, item.id);
  }
};

export const syncQueue = {
  addToQueue,
  getPendingItems,
  updateQueueItemStatus,
  processQueue,
  clearCompletedItems,
  QUEUE_STATES
};