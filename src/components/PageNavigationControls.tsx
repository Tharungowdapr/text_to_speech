import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Square, AlertCircle } from 'lucide-react';
import { PageAudioSynchronizer, PlaybackState } from '../utils/pageAudioSync';

interface PageNavigationControlsProps {
  synchronizer: PageAudioSynchronizer | null;
  onPageChange: (pageNumber: number) => void;
  onPlaybackToggle: (isPlaying: boolean) => void;
  onStop: () => void;
  darkMode?: boolean;
  className?: string;
}

export function PageNavigationControls({
  synchronizer,
  onPageChange,
  onPlaybackToggle,
  onStop,
  darkMode = false,
  className = ''
}: PageNavigationControlsProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [pageInput, setPageInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to playback state changes
  useEffect(() => {
    if (!synchronizer) return;

    const handleStateChange = (state: PlaybackState) => {
      setPlaybackState(state);
      setPageInput(state.currentPage.toString());
    };

    const handleError = (error: string) => {
      setInputError(error);
      setTimeout(() => setInputError(''), 5000);
    };

    // Get initial state
    const initialState = synchronizer.getPlaybackState();
    handleStateChange(initialState);

    return () => {
      // Cleanup if needed
    };
  }, [synchronizer]);

  // Handle page input change
  const handlePageInputChange = (value: string) => {
    setPageInput(value);
    setInputError('');
  };

  // Handle page input submission
  const handlePageInputSubmit = async () => {
    if (!synchronizer || !playbackState) return;

    const pageNumber = parseInt(pageInput);
    
    // Validate input
    if (isNaN(pageNumber)) {
      setInputError('Please enter a valid page number');
      return;
    }

    if (pageNumber < 1 || pageNumber > playbackState.totalPages) {
      setInputError(`Page number must be between 1 and ${playbackState.totalPages}`);
      return;
    }

    setIsNavigating(true);
    setInputError('');

    try {
      const success = await synchronizer.navigateToPage(pageNumber, playbackState.isPlaying);
      if (success) {
        onPageChange(pageNumber);
      }
    } catch (error) {
      setInputError(`Failed to navigate to page ${pageNumber}`);
    } finally {
      setIsNavigating(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handlePageInputSubmit();
    } else if (event.key === 'Escape') {
      if (playbackState) {
        setPageInput(playbackState.currentPage.toString());
        setInputError('');
      }
    }
  };

  // Navigation handlers
  const handlePreviousPage = async () => {
    if (!synchronizer || !playbackState || playbackState.currentPage <= 1) return;
    
    setIsNavigating(true);
    try {
      const success = await synchronizer.navigateToPage(
        playbackState.currentPage - 1, 
        playbackState.isPlaying
      );
      if (success) {
        onPageChange(playbackState.currentPage - 1);
      }
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNextPage = async () => {
    if (!synchronizer || !playbackState || playbackState.currentPage >= playbackState.totalPages) return;
    
    setIsNavigating(true);
    try {
      const success = await synchronizer.navigateToPage(
        playbackState.currentPage + 1, 
        playbackState.isPlaying
      );
      if (success) {
        onPageChange(playbackState.currentPage + 1);
      }
    } finally {
      setIsNavigating(false);
    }
  };

  const handlePlayPause = () => {
    if (!playbackState) return;
    onPlaybackToggle(!playbackState.isPlaying);
  };

  const handleStop = () => {
    onStop();
  };

  if (!playbackState) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        <span className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Loading navigation...
        </span>
      </div>
    );
  }

  const progressPercentage = Math.round(playbackState.playbackPosition * 100);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Display */}
      {inputError && (
        <div className={`
          flex items-center gap-2 p-3 rounded-lg border-l-4 border-red-500
          ${darkMode ? 'bg-red-900 bg-opacity-20 text-red-300' : 'bg-red-50 text-red-700'}
        `}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{inputError}</span>
        </div>
      )}

      {/* Page Navigation */}
      <div className={`
        flex items-center gap-4 p-4 rounded-lg
        ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
      `}>
        {/* Previous Page Button */}
        <button
          onClick={handlePreviousPage}
          disabled={playbackState.currentPage <= 1 || isNavigating}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${playbackState.currentPage <= 1 || isNavigating
              ? 'opacity-50 cursor-not-allowed'
              : darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }
          `}
          title="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Page Input */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Page
          </span>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={playbackState.totalPages}
            value={pageInput}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onBlur={handlePageInputSubmit}
            className={`
              w-16 px-2 py-1 text-center rounded border text-sm
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
              }
              ${inputError ? 'border-red-500' : ''}
            `}
            disabled={isNavigating}
          />
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            of {playbackState.totalPages}
          </span>
        </div>

        {/* Next Page Button */}
        <button
          onClick={handleNextPage}
          disabled={playbackState.currentPage >= playbackState.totalPages || isNavigating}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${playbackState.currentPage >= playbackState.totalPages || isNavigating
              ? 'opacity-50 cursor-not-allowed'
              : darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }
          `}
          title="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className={`w-px h-8 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />

        {/* Audio Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${darkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
            title={playbackState.isPlaying ? 'Pause' : 'Play'}
          >
            {playbackState.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={handleStop}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }
            `}
            title="Stop"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className={`
        p-3 rounded-lg
        ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
      `}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Page Progress
          </span>
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {progressPercentage}%
          </span>
        </div>
        
        <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-1">
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Start of page
          </span>
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            End of page
          </span>
        </div>
      </div>

      {/* Navigation Status */}
      {isNavigating && (
        <div className={`
          flex items-center justify-center gap-2 p-2 rounded-lg
          ${darkMode ? 'bg-blue-900 bg-opacity-20 text-blue-300' : 'bg-blue-50 text-blue-700'}
        `}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          <span className="text-sm">Navigating...</span>
        </div>
      )}
    </div>
  );
}