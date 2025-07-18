import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Hash } from 'lucide-react';

interface PageContent {
  id: string;
  title: string;
  content: string;
  metadata?: {
    wordCount: number;
    estimatedReadTime: number;
  };
}

interface DynamicPageNavigatorProps {
  pages: PageContent[];
  currentPageIndex: number;
  onPageChange: (pageIndex: number) => void;
  onContentSelect?: (content: string, pageIndex: number) => void;
  darkMode?: boolean;
  className?: string;
}

export function DynamicPageNavigator({
  pages,
  currentPageIndex,
  onPageChange,
  onContentSelect,
  darkMode = false,
  className = ''
}: DynamicPageNavigatorProps) {
  const [inputPageNumber, setInputPageNumber] = useState('');
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [showPointer, setShowPointer] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);

  // Dynamic navigation commands based on current state
  const navigationCommands = {
    canGoFirst: currentPageIndex > 0,
    canGoPrevious: currentPageIndex > 0,
    canGoNext: currentPageIndex < pages.length - 1,
    canGoLast: currentPageIndex < pages.length - 1,
    totalPages: pages.length,
    currentPage: currentPageIndex + 1,
    isFirstPage: currentPageIndex === 0,
    isLastPage: currentPageIndex === pages.length - 1
  };

  // Event listener for page changes - updates pointer instantly
  useEffect(() => {
    const handlePageChange = () => {
      updatePointerContent();
      // Trigger pointer animation to show content update
      setShowPointer(true);
      setTimeout(() => setShowPointer(false), 2000);
    };

    // Listen for page changes
    handlePageChange();
  }, [currentPageIndex, pages]);

  // Dynamic pointer content update
  const updatePointerContent = useCallback(() => {
    if (pages[currentPageIndex] && pointerRef.current) {
      const currentPage = pages[currentPageIndex];
      const pointerElement = pointerRef.current;
      
      // Update pointer text content instantly
      pointerElement.textContent = `Page ${currentPageIndex + 1}: ${currentPage.title}`;
      
      // Add dynamic metadata if available
      if (currentPage.metadata) {
        const metaInfo = ` (${currentPage.metadata.wordCount} words, ~${currentPage.metadata.estimatedReadTime}min read)`;
        pointerElement.textContent += metaInfo;
      }
    }
  }, [currentPageIndex, pages]);

  // Dynamic navigation handlers
  const handleNavigation = {
    first: () => {
      if (navigationCommands.canGoFirst) {
        onPageChange(0);
      }
    },
    previous: () => {
      if (navigationCommands.canGoPrevious) {
        onPageChange(currentPageIndex - 1);
      }
    },
    next: () => {
      if (navigationCommands.canGoNext) {
        onPageChange(currentPageIndex + 1);
      }
    },
    last: () => {
      if (navigationCommands.canGoLast) {
        onPageChange(pages.length - 1);
      }
    },
    jumpTo: (pageNumber: number) => {
      // Handle edge cases dynamically
      const targetPage = Math.max(1, Math.min(pageNumber, pages.length));
      const targetIndex = targetPage - 1;
      
      if (targetIndex !== currentPageIndex && targetIndex >= 0 && targetIndex < pages.length) {
        onPageChange(targetIndex);
      }
    }
  };

  // Handle jump to page modal
  const handleJumpToPage = () => {
    const pageNumber = parseInt(inputPageNumber);
    if (!isNaN(pageNumber)) {
      handleNavigation.jumpTo(pageNumber);
      setInputPageNumber('');
      setIsJumpModalOpen(false);
    }
  };

  // Handle content selection with pointer feedback
  const handleContentClick = (event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPointerPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
      setShowPointer(true);
      
      if (onContentSelect && pages[currentPageIndex]) {
        onContentSelect(pages[currentPageIndex].content, currentPageIndex);
      }
      
      setTimeout(() => setShowPointer(false), 1500);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handleNavigation.previous();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNavigation.next();
          break;
        case 'Home':
          event.preventDefault();
          handleNavigation.first();
          break;
        case 'End':
          event.preventDefault();
          handleNavigation.last();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPageIndex, pages.length]);

  if (pages.length === 0) {
    return (
      <div className={`text-center p-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        No pages available
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* Dynamic Pointer Display */}
      <div
        ref={pointerRef}
        className={`
          fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg
          transition-all duration-300 pointer-events-none
          ${showPointer ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
          ${darkMode ? 'bg-gray-800 text-white border border-gray-600' : 'bg-white text-gray-800 border border-gray-200'}
        `}
      >
        {/* Content updated dynamically via updatePointerContent */}
      </div>

      {/* Navigation Header */}
      <div className={`
        flex items-center justify-between p-4 rounded-t-lg border-b
        ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}
      `}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNavigation.first}
            disabled={!navigationCommands.canGoFirst}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${navigationCommands.canGoFirst
                ? darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'opacity-50 cursor-not-allowed'
              }
            `}
            title="First page"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleNavigation.previous}
            disabled={!navigationCommands.canGoPrevious}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${navigationCommands.canGoPrevious
                ? darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'opacity-50 cursor-not-allowed'
              }
            `}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Page Counter */}
        <div className="flex items-center gap-4">
          <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>
            Page {navigationCommands.currentPage} of {navigationCommands.totalPages}
          </span>
          
          <button
            onClick={() => setIsJumpModalOpen(true)}
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all duration-200
              ${darkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
            title="Jump to page"
          >
            <Hash className="w-3 h-3" />
            Jump
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNavigation.next}
            disabled={!navigationCommands.canGoNext}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${navigationCommands.canGoNext
                ? darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'opacity-50 cursor-not-allowed'
              }
            `}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleNavigation.last}
            disabled={!navigationCommands.canGoLast}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${navigationCommands.canGoLast
                ? darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'opacity-50 cursor-not-allowed'
              }
            `}
            title="Last page"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Page Content Display */}
      <div 
        className={`
          p-6 min-h-[400px] cursor-pointer transition-all duration-200
          ${darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}
        `}
        onClick={handleContentClick}
      >
        <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          {currentPage.title}
        </h2>
        
        <div className={`prose max-w-none ${darkMode ? 'prose-invert' : ''}`}>
          <p className={`leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {currentPage.content}
          </p>
        </div>

        {/* Dynamic Metadata Display */}
        {currentPage.metadata && (
          <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <div className="flex gap-4 text-sm">
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                Words: {currentPage.metadata.wordCount}
              </span>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                Est. read time: {currentPage.metadata.estimatedReadTime} min
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Jump to Page Modal */}
      {isJumpModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`
            max-w-sm w-full mx-4 p-6 rounded-lg
            ${darkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Jump to Page
            </h3>
            
            <div className="mb-4">
              <input
                type="number"
                min="1"
                max={navigationCommands.totalPages}
                value={inputPageNumber}
                onChange={(e) => setInputPageNumber(e.target.value)}
                placeholder={`1-${navigationCommands.totalPages}`}
                className={`
                  w-full px-3 py-2 rounded-lg border
                  ${darkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 placeholder-gray-500'
                  }
                `}
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleJumpToPage()}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleJumpToPage}
                className={`
                  flex-1 py-2 px-4 rounded-lg transition-colors
                  ${darkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }
                `}
              >
                Jump
              </button>
              <button
                onClick={() => {
                  setIsJumpModalOpen(false);
                  setInputPageNumber('');
                }}
                className={`
                  flex-1 py-2 px-4 rounded-lg transition-colors
                  ${darkMode
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }
                `}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Status Indicators */}
      <div className={`
        flex justify-between items-center p-3 text-xs rounded-b-lg
        ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}
      `}>
        <div className="flex gap-4">
          <span className={navigationCommands.isFirstPage ? 'text-blue-500' : ''}>
            {navigationCommands.isFirstPage ? '● First Page' : '○ Not First'}
          </span>
          <span className={navigationCommands.isLastPage ? 'text-red-500' : ''}>
            {navigationCommands.isLastPage ? '● Last Page' : '○ Not Last'}
          </span>
        </div>
        
        <div>
          Progress: {Math.round((navigationCommands.currentPage / navigationCommands.totalPages) * 100)}%
        </div>
      </div>
    </div>
  );
}