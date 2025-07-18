import React, { useState } from 'react';
import { DynamicPageNavigator } from './DynamicPageNavigator';

// Sample pages to demonstrate functionality
const samplePages = [
  {
    id: 'page-1',
    title: 'Introduction to Dynamic Navigation',
    content: `Welcome to the dynamic page navigation system! This system automatically updates pointers and navigation controls based on the current page state. 
    
    The navigation is fully dynamic, meaning all controls adapt to the total number of pages without any hard-coded values. When you navigate between pages, the pointer instantly reflects the current page's content.
    
    Key features include:
    • Instant pointer synchronization
    • Dynamic command generation
    • Real-time content updates
    • Edge case handling
    • Keyboard navigation support`,
    metadata: {
      wordCount: 89,
      estimatedReadTime: 1
    }
  },
  {
    id: 'page-2',
    title: 'Advanced Navigation Features',
    content: `This page demonstrates the advanced features of our navigation system. Notice how the pointer updates immediately when you arrive here, and all navigation controls remain fully functional.
    
    The system handles edge cases automatically:
    • First page: Previous/First buttons are disabled
    • Last page: Next/Last buttons are disabled
    • Invalid page numbers: Automatically corrected
    • Dynamic page count: Adapts to content changes
    
    Try using keyboard navigation:
    • Arrow Left/Right: Navigate pages
    • Home/End: Jump to first/last page
    • Click anywhere on content: Trigger pointer feedback`,
    metadata: {
      wordCount: 112,
      estimatedReadTime: 1
    }
  },
  {
    id: 'page-3',
    title: 'Real-time Synchronization Demo',
    content: `This final page showcases the real-time synchronization capabilities. Every navigation action triggers immediate updates across all system components.
    
    The pointer system works by:
    1. Detecting page changes through event listeners
    2. Updating content instantly without delays
    3. Providing visual feedback for user interactions
    4. Maintaining state consistency across all components
    
    Technical implementation highlights:
    • Event-driven architecture
    • Reactive state management
    • Optimized re-rendering
    • Cross-component synchronization
    • Mobile-responsive design
    
    Try the "Jump to Page" feature to see instant navigation to any page number!`,
    metadata: {
      wordCount: 134,
      estimatedReadTime: 2
    }
  }
];

interface PageNavigationDemoProps {
  darkMode?: boolean;
}

export function PageNavigationDemo({ darkMode = false }: PageNavigationDemoProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);

  const handlePageChange = (pageIndex: number) => {
    setCurrentPageIndex(pageIndex);
    console.log(`Navigated to page ${pageIndex + 1}`);
  };

  const handleContentSelect = (content: string, pageIndex: number) => {
    setSelectedContent(content);
    console.log(`Selected content from page ${pageIndex + 1}:`, content.substring(0, 50) + '...');
    
    // Clear selection after 3 seconds
    setTimeout(() => setSelectedContent(null), 3000);
  };

  return (
    <div className={`max-w-4xl mx-auto p-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} min-h-screen`}>
      <div className="mb-6">
        <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          Dynamic Page Navigation Demo
        </h1>
        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Experience real-time pointer synchronization and dynamic navigation controls
        </p>
      </div>

      <DynamicPageNavigator
        pages={samplePages}
        currentPageIndex={currentPageIndex}
        onPageChange={handlePageChange}
        onContentSelect={handleContentSelect}
        darkMode={darkMode}
        className="shadow-lg rounded-lg overflow-hidden"
      />

      {/* Selected Content Display */}
      {selectedContent && (
        <div className={`
          mt-6 p-4 rounded-lg border-l-4 border-blue-500
          ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-blue-50 text-gray-700'}
        `}>
          <h3 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Selected Content:
          </h3>
          <p className="text-sm">
            {selectedContent.substring(0, 200)}...
          </p>
        </div>
      )}

      {/* Usage Instructions */}
      <div className={`
        mt-8 p-6 rounded-lg
        ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
      `}>
        <h3 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
          How to Use:
        </h3>
        <ul className={`space-y-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <li>• Use navigation buttons to move between pages</li>
          <li>• Watch the pointer update instantly with each page change</li>
          <li>• Click "Jump" to navigate directly to any page number</li>
          <li>• Use keyboard arrows (←/→) for quick navigation</li>
          <li>• Click anywhere on page content to trigger pointer feedback</li>
          <li>• Notice how all controls adapt dynamically to the current state</li>
        </ul>
      </div>
    </div>
  );
}