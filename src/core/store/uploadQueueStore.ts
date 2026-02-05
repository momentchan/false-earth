import { create } from 'zustand';

interface UploadQueueState {
  uploadQueue: string[];
  currentUploader: string | null;
  
  enqueueUpload: (id: string) => void;
  processNextUpload: () => void;
  removeUpload: (id: string) => void;
}

export const useUploadQueueStore = create<UploadQueueState>((set) => ({
  uploadQueue: [],
  currentUploader: null,

  enqueueUpload: (id) => set((state) => {
    if (state.currentUploader === null) {
      return { currentUploader: id };
    }
    if (state.uploadQueue.includes(id)) return state;
    return { uploadQueue: [...state.uploadQueue, id] };
  }),

  processNextUpload: () => set((state) => {
    if (state.uploadQueue.length > 0) {
      const [next, ...rest] = state.uploadQueue;
      return { 
        currentUploader: next, 
        uploadQueue: rest 
      };
    }
    return { currentUploader: null };
  }),

  removeUpload: (id) => set((state) => {
    if (state.currentUploader === id) {
      const [next, ...rest] = state.uploadQueue;
      return { currentUploader: next || null, uploadQueue: rest };
    }
    return { uploadQueue: state.uploadQueue.filter((i) => i !== id) };
  }),
}));
