import React, { useEffect, useRef } from 'react';

interface TextHighlighterProps {
  sentences: string[];
  currentSentence: number;
  onSentenceClick: (index: number) => void;
  darkMode: boolean;
  autoScroll: boolean;
  className?: string;
}

export function TextHighlighter({
  sentences,
  currentSentence,
  onSentenceClick,
  darkMode,
  autoScroll,
  className = ''
}: TextHighlighterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSentenceRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current sentence
  useEffect(() => {
    if (autoScroll && currentSentenceRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = currentSentenceRef.current;
      
      // Calculate scroll position to center the element
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;
      
      const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
    }
  }, [currentSentence, autoScroll]);

  if (sentences.length === 0) {
    return (
      <div className={`
        flex items-center justify-center h-full
        ${darkMode ? 'text-gray-400' : 'text-gray-500'}
        ${className}
      `}>
        <p className="text-lg text-center px-4">
          No text available. Upload a PDF or enter text to start.
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`
        h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent
        ${darkMode ? 'scrollbar-thumb-gray-600' : 'scrollbar-thumb-gray-300'}
        ${className}
      `}
    >
      <div className="space-y-2 p-4">
        {sentences.map((sentence, index) => {
          const isActive = index === currentSentence;
          const isPrevious = index < currentSentence;
          
          return (
            <div
              key={index}
              ref={isActive ? currentSentenceRef : null}
              onClick={() => onSentenceClick(index)}
              className={`
                p-3 rounded-lg cursor-pointer transition-all duration-300 transform
                hover:scale-[1.02] active:scale-[0.98] touch-manipulation
                ${isActive
                  ? darkMode
                    ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                    : 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300'
                  : isPrevious
                    ? darkMode
                      ? 'bg-gray-700 text-gray-300 opacity-70'
                      : 'bg-gray-100 text-gray-600 opacity-70'
                    : darkMode
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }
                ${isActive ? 'animate-pulse-subtle' : ''}
              `}
              role="button"
              tabIndex={0}
              aria-label={`Sentence ${index + 1}: ${sentence.substring(0, 50)}...`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSentenceClick(index);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <span className={`
                  flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isActive
                    ? 'bg-white text-blue-600'
                    : darkMode
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-200 text-gray-600'
                  }
                `}>
                  {index + 1}
                </span>
                <p className="flex-1 leading-relaxed text-sm sm:text-base">
                  {sentence}
                </p>
              </div>
              
              {/* Progress indicator for active sentence */}
              {isActive && (
                <div className="mt-2 h-1 bg-white bg-opacity-30 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full animate-progress-bar" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}