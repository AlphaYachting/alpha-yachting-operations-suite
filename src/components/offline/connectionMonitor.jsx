// Connection status monitoring and sync management
let listeners = [];

const isOnline = () => {
  return navigator.onLine;
};

const subscribe = (callback) => {
  listeners.push(callback);
  
  const handleOnline = () => {
    callback({ isOnline: true });
  };
  
  const handleOffline = () => {
    callback({ isOnline: false });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    listeners = listeners.filter(l => l !== callback);
  };
};

const notifyListeners = (status) => {
  listeners.forEach(callback => callback(status));
};

export const connectionMonitor = {
  isOnline,
  subscribe
};