import React, { useEffect, useState } from 'react';
import { VoiceManager, VoiceInfo } from '../utils/voiceManager';
import { Mic, Star, Globe } from 'lucide-react';

interface VoiceSelectorProps {
  selectedVoiceURI: string;
  onVoiceChange: (voiceURI: string) => void;
  preferredType: 'google' | 'system';
  onPreferredTypeChange: (type: 'google' | 'system') => void;
  darkMode: boolean;
  className?: string;
}

export function VoiceSelector({
  selectedVoiceURI,
  onVoiceChange,
  preferredType,
  onPreferredTypeChange,
  darkMode,
  className = ''
}: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const voiceManager = VoiceManager.getInstance();

  useEffect(() => {
    const initializeVoices = async () => {
      setIsLoading(true);
      await voiceManager.initialize();
      const englishVoices = voiceManager.getEnglishVoices();
      setVoices(englishVoices);
      
      // Auto-select best voice if none selected
      if (!selectedVoiceURI && englishVoices.length > 0) {
        const bestVoice = voiceManager.getBestVoice(preferredType === 'google');
        if (bestVoice) {
          onVoiceChange(bestVoice.voiceURI);
        }
      }
      
      setIsLoading(false);
    };

    initializeVoices();
  }, [selectedVoiceURI, preferredType, onVoiceChange]);

  const googleVoices = voices.filter(v => v.isGoogle);
  const systemVoices = voices.filter(v => !v.isGoogle);

  const handleVoiceChange = (voiceURI: string) => {
    onVoiceChange(voiceURI);
    
    // Update preferred type based on selection
    const selectedVoice = voices.find(v => v.voice.voiceURI === voiceURI);
    if (selectedVoice) {
      onPreferredTypeChange(selectedVoice.isGoogle ? 'google' : 'system');
    }
  };

  const testVoice = (voice: SpeechSynthesisVoice) => {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance('Hello, this is a voice test.');
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <div className={`
        flex items-center justify-center p-4 rounded-lg
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}
        ${className}
      `}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2" />
        Loading voices...
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Voice Type Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => onPreferredTypeChange('google')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all duration-200
            ${preferredType === 'google'
              ? darkMode
                ? 'bg-blue-600 text-white'
                : 'bg-blue-500 text-white'
              : darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }
          `}
        >
          <Star className="w-4 h-4" />
          Google ({googleVoices.length})
        </button>
        <button
          onClick={() => onPreferredTypeChange('system')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all duration-200
            ${preferredType === 'system'
              ? darkMode
                ? 'bg-blue-600 text-white'
                : 'bg-blue-500 text-white'
              : darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }
          `}
        >
          <Globe className="w-4 h-4" />
          System ({systemVoices.length})
        </button>
      </div>

      {/* Voice List */}
      <div className={`
        max-h-64 overflow-y-auto rounded-lg border
        ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'}
      `}>
        {(preferredType === 'google' ? googleVoices : systemVoices).map((voiceInfo) => {
          const { voice, isGoogle, quality } = voiceInfo;
          const isSelected = voice.voiceURI === selectedVoiceURI;
          
          return (
            <div
              key={voice.voiceURI}
              className={`
                flex items-center justify-between p-3 border-b last:border-b-0 transition-colors duration-200
                ${darkMode ? 'border-gray-700' : 'border-gray-100'}
                ${isSelected
                  ? darkMode
                    ? 'bg-blue-900 bg-opacity-50'
                    : 'bg-blue-50'
                  : darkMode
                    ? 'hover:bg-gray-700'
                    : 'hover:bg-gray-50'
                }
              `}
            >
              <div className="flex-1">
                <button
                  onClick={() => handleVoiceChange(voice.voiceURI)}
                  className="text-left w-full"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => handleVoiceChange(voice.voiceURI)}
                      className="text-blue-500"
                    />
                    <div>
                      <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {voice.name}
                        {isGoogle && <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">Google</span>}
                        {quality > 150 && <span className="ml-1">⭐</span>}
                      </p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {voice.lang} • {voice.localService ? 'Local' : 'Network'}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
              
              <button
                onClick={() => testVoice(voice)}
                className={`
                  p-2 rounded-full transition-colors duration-200
                  ${darkMode
                    ? 'hover:bg-gray-600 text-gray-300'
                    : 'hover:bg-gray-200 text-gray-600'
                  }
                `}
                aria-label={`Test ${voice.name} voice`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {voices.length === 0 && (
        <div className={`
          text-center p-4 rounded-lg
          ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}
        `}>
          No English voices available. Please check your browser settings.
        </div>
      )}
    </div>
  );
}