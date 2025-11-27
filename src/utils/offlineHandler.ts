import toast from 'react-hot-toast';

export const handleOfflineError = (error: unknown): boolean => {
  if (error instanceof Error && error.message.startsWith('OFFLINE_QUEUED:')) {
    const actionId = error.message.split(':')[1];
    toast.success('Action enregistrée pour synchronisation hors ligne', {
      icon: '📴',
      duration: 4000
    });
    return true;
  }
  return false;
};

