import React, { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { useStore } from '../store';
import { Search, Bookmark, MessageSquarePlus, Eye } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFViewerProps {
  file: File | null;
  currentSentence: string;
  currentPage: number;
  autoScroll: boolean;
  highlightText?: string;
}

export function PDFViewer({ file, currentSentence, currentPage, autoScroll, highlightText }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [showTextLayer, setShowTextLayer] = useState(true);
  const { darkMode, currentHighlight } = useStore();

  useEffect(() => {
    if (autoScroll && currentPage) {
      setPageNumber(currentPage);
    }
  }, [currentPage, autoScroll]);

  useEffect(() => {
    // Highlight current sentence in PDF
    if (currentHighlight && currentHighlight.pageNumber === pageNumber) {
      const textLayer = document.querySelector('.react-pdf__Page__textContent');
      if (textLayer) {
        // Remove previous highlights
        const previousHighlights = textLayer.querySelectorAll('.sentence-highlight');
        previousHighlights.forEach(el => {
          el.classList.remove('sentence-highlight');
        });

        // Add new highlight
        const textElements = textLayer.querySelectorAll('span');
        const searchText = currentHighlight.text.toLowerCase();
        
        textElements.forEach(element => {
          if (element.textContent && searchText.includes(element.textContent.toLowerCase().trim())) {
            element.classList.add('sentence-highlight');
          }
        });
      }
    }
  }, [currentHighlight, pageNumber]);
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
          <button
            onClick={() => setShowTextLayer(!showTextLayer)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
              darkMode 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Eye className="w-4 h-4" />
            {showTextLayer ? 'Hide' : 'Show'} Text
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
            renderTextLayer={showTextLayer}
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