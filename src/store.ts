import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PDFData {
  id: string;
  name: string;
  lastOpened: string;
  file: File;
}

export interface HighlightData {
  pageNumber: number;
  text: string;
}

interface AppState {
  // Theme
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;

  // PDF Management
  recentPDFs: PDFData[];
  addRecentPDF: (pdf: PDFData) => void;
  removeRecentPDF: (id: string) => void;
  clearRecentPDFs: () => void;

  // Text Highlighting
  currentHighlight: HighlightData | null;
  setCurrentHighlight: (highlight: HighlightData | null) => void;

  // Playback Settings
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  playbackVolume: number;
  setPlaybackVolume: (volume: number) => void;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;

  // Voice Settings
  selectedVoiceURI: string | null;
  setSelectedVoiceURI: (uri: string | null) => void;
  preferredVoiceType: 'google' | 'system';
  setPreferredVoiceType: (type: 'google' | 'system') => void;

  // Text-to-Speech Management
  savedTexts: Array<{ id: string; title: string; content: string; createdAt: string }>;
  addSavedText: (text: { title: string; content: string }) => void;
  removeSavedText: (id: string) => void;
  updateSavedText: (id: string, updates: { title?: string; content?: string }) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      darkMode: false,
      setDarkMode: (darkMode) => set({ darkMode }),

      // PDF Management
      recentPDFs: [],
      addRecentPDF: (pdf) => {
        const current = get().recentPDFs;
        const filtered = current.filter(p => p.id !== pdf.id);
        set({ recentPDFs: [pdf, ...filtered].slice(0, 10) });
      },
      removeRecentPDF: (id) => {
        const current = get().recentPDFs;
        set({ recentPDFs: current.filter(p => p.id !== id) });
      },
      clearRecentPDFs: () => set({ recentPDFs: [] }),

      // Text Highlighting
      currentHighlight: null,
      setCurrentHighlight: (highlight) => set({ currentHighlight: highlight }),

      // Playback Settings
      playbackSpeed: 1.0,
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      playbackVolume: 1.0,
      setPlaybackVolume: (volume) => set({ playbackVolume: volume }),
      autoScroll: true,
      setAutoScroll: (autoScroll) => set({ autoScroll }),

      // Voice Settings
      selectedVoiceURI: null,
      setSelectedVoiceURI: (uri) => set({ selectedVoiceURI: uri }),
      preferredVoiceType: 'google',
      setPreferredVoiceType: (type) => set({ preferredVoiceType: type }),

      // Text-to-Speech Management
      savedTexts: [],
      addSavedText: (text) => {
        const newText = {
          id: Date.now().toString(),
          title: text.title,
          content: text.content,
          createdAt: new Date().toISOString(),
        };
        const current = get().savedTexts;
        set({ savedTexts: [newText, ...current] });
      },
      removeSavedText: (id) => {
        const current = get().savedTexts;
        set({ savedTexts: current.filter(t => t.id !== id) });
      },
      updateSavedText: (id, updates) => {
        const current = get().savedTexts;
        set({
          savedTexts: current.map(t =>
            t.id === id ? { ...t, ...updates } : t
          ),
        });
      },
    }),
    {
      name: 'pdf-reader-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        playbackSpeed: state.playbackSpeed,
        playbackVolume: state.playbackVolume,
        autoScroll: state.autoScroll,
        selectedVoiceURI: state.selectedVoiceURI,
        preferredVoiceType: state.preferredVoiceType,
        savedTexts: state.savedTexts,
      }),
    }
  )
);