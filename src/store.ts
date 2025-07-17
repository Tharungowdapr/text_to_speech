import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PDFData {
  id: string;
  name: string;
  lastOpened: string;
  file: File;
}

interface Annotation {
  id: string;
  pageNumber: number;
  text: string;
  color: string;
  position: { x: number; y: number };
}

interface Bookmark {
  id: string;
  pageNumber: number;
  text: string;
  timestamp: number;
}

interface AppState {
  darkMode: boolean;
  annotations: Annotation[];
  bookmarks: Bookmark[];
  searchQuery: string;
  searchResults: { pageNumber: number; text: string }[];
  currentHighlight: { pageNumber: number; text: string } | null;
  recentPDFs: PDFData[];
  setDarkMode: (darkMode: boolean) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: { pageNumber: number; text: string }[]) => void;
  setCurrentHighlight: (highlight: { pageNumber: number; text: string } | null) => void;
  addRecentPDF: (pdf: PDFData) => void;
  removeRecentPDF: (id: string) => void;
  updatePDFLastOpened: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      darkMode: true, // Set dark mode as default
      annotations: [],
      bookmarks: [],
      searchQuery: '',
      searchResults: [],
      currentHighlight: null,
      recentPDFs: [],
      setDarkMode: (darkMode) => set({ darkMode }),
      addAnnotation: (annotation) =>
        set((state) => ({ annotations: [...state.annotations, annotation] })),
      removeAnnotation: (id) =>
        set((state) => ({
          annotations: state.annotations.filter((a) => a.id !== id),
        })),
      addBookmark: (bookmark) =>
        set((state) => ({ bookmarks: [...state.bookmarks, bookmark] })),
      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchResults: (searchResults) => set({ searchResults }),
      setCurrentHighlight: (currentHighlight) => set({ currentHighlight }),
      addRecentPDF: (pdf) =>
        set((state) => {
          const existingPDFs = state.recentPDFs.filter((p) => p.id !== pdf.id);
          return {
            recentPDFs: [pdf, ...existingPDFs].slice(0, 10), // Keep only the 10 most recent PDFs
          };
        }),
      removeRecentPDF: (id) =>
        set((state) => ({
          recentPDFs: state.recentPDFs.filter((p) => p.id !== id),
        })),
      updatePDFLastOpened: (id) =>
        set((state) => ({
          recentPDFs: state.recentPDFs.map((pdf) =>
            pdf.id === id
              ? { ...pdf, lastOpened: new Date().toISOString() }
              : pdf
          ),
        })),
    }),
    {
      name: 'pdf-reader-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        recentPDFs: [], // Don't persist PDF files, only store in memory
      }),
    }
  )
);