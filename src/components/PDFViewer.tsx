import React, { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { useStore } from '../store';
import { Search, Bookmark, MessageSquarePlus } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFViewerProps {
  file: File | null;
  currentSentence: string;
  currentPage: number;
  autoScroll: boolean;
}

export function PDFViewer({ file, currentSentence, currentPage, autoScroll }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const { darkMode } = useStore();

  useEffect(() => {
    if (autoScroll && currentPage) {
      setPageNumber(currentPage);
    }
  }, [currentPage, autoScroll]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
  }

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className={`px-3 py-1 rounded ${
              darkMode 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-white hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            Previous
          </button>
          <span className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
            disabled={pageNumber >= numPages}
            className={`px-3 py-1 rounded ${
              darkMode 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-white hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className={`px-2 py-1 rounded ${
              darkMode 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            -
          </button>
          <span className={`${darkMode ? 'text-white' : 'text-gray-700'}`}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className={`px-2 py-1 rounded ${
              darkMode 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            +
          </button>
        </div>
      </div>
      <div className="flex justify-center">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          className={darkMode ? 'dark' : ''}
          loading={
            <div className={`flex items-center justify-center p-4 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
              Loading PDF...
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div className={`flex items-center justify-center p-4 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                Loading page...
              </div>
            }
          />
        </Document>
      </div>
    </div>
  );
}