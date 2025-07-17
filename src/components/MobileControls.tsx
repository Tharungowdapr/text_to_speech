import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Volume2, Settings2 } from 'lucide-react';

interface MobileControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onJumpBack: () => void;
  onJumpForward: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
  darkMode: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export function MobileControls({
  isPlaying,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  onJumpBack,
  onJumpForward,
  volume,
  onVolumeChange,
  speed,
  onSpeedChange,
  disabled = false,
  darkMode,
  showSettings,
  onToggleSettings
}: MobileControlsProps) {
  const buttonClass = `
    flex items-center justify-center rounded-full transition-all duration-200 
    active:scale-95 touch-manipulation select-none
    ${darkMode 
      ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white shadow-lg' 
      : 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 shadow-md border border-gray-200'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

  const smallButtonClass = `${buttonClass} w-12 h-12`;
  const largeButtonClass = `${buttonClass} w-16 h-16`;

  return (
    <div className="space-y-4">
      {/* Main Playback Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onJumpBack}
          disabled={disabled}
          className={smallButtonClass}
          aria-label="Jump back 10 seconds"
        >
          <Rewind className="w-5 h-5" />
        </button>
        
        <button
          onClick={onSkipBack}
          disabled={disabled}
          className={smallButtonClass}
          aria-label="Previous sentence"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        
        <button
          onClick={onTogglePlay}
          disabled={disabled}
          className={largeButtonClass}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </button>
        
        <button
          onClick={onSkipForward}
          disabled={disabled}
          className={smallButtonClass}
          aria-label="Next sentence"
        >
          <SkipForward className="w-5 h-5" />
        </button>
        
        <button
          onClick={onJumpForward}
          disabled={disabled}
          className={smallButtonClass}
          aria-label="Jump forward 10 seconds"
        >
          <FastForward className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Toggle */}
      <div className="flex justify-center">
        <button
          onClick={onToggleSettings}
          className={`${smallButtonClass} ${showSettings ? 'ring-2 ring-blue-500' : ''}`}
          aria-label="Toggle settings"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`
          p-4 rounded-xl transition-all duration-300 transform
          ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
          shadow-lg
        `}>
          {/* Volume Control */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <Volume2 className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                Volume: {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className={`
                w-full h-2 rounded-lg appearance-none cursor-pointer
                ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}
                slider-thumb
              `}
            />
          </div>

          {/* Speed Control */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings2 className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                Speed: {speed}x
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speedOption) => (
                <button
                  key={speedOption}
                  onClick={() => onSpeedChange(speedOption)}
                  className={`
                    py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${speed === speedOption
                      ? darkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }
                  `}
                >
                  {speedOption}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}