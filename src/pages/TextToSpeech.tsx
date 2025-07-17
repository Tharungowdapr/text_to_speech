import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Save, Trash2, Moon, Sun, FileText, Mic2 } from 'lucide-react';
import { useStore } from '../store';
import { VoiceManager } from '../utils/voiceManager';
import { MobileControls } from '../components/MobileControls';
import { TextHighlighter } from '../components/TextHighlighter';
import { VoiceSelector } from '../components/VoiceSelector';
import { saveAs } from 'file-saver';

interface SavedText {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export function TextToSpeech() {
  const navigate = useNavigate();
  const { 
    darkMode, 
    setDarkMode, 
    playbackSpeed, 
    setPlaybackSpeed, 
    playbackVolume, 
    setPlaybackVolume,
    selectedVoiceURI,
    setSelectedVoiceURI,
    preferredVoiceType,
    setPreferredVoiceType,
    autoScroll,
    setAutoScroll
  } = useStore();

  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [savedTexts, setSavedTexts] = useState<SavedText[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const speechSynthesis = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceManager = VoiceManager.getInstance();

  useEffect(() => {
    const initializeVoices = async () => {
      await voiceManager.initialize();
      
      if (selectedVoiceURI) {
        const voice = voiceManager.getVoiceByURI(selectedVoiceURI);
        setSelectedVoice(voice);
      } else {
        const bestVoice = voiceManager.getBestVoice(preferredVoiceType === 'google');
        if (bestVoice) {
          setSelectedVoice(bestVoice);
          setSelectedVoiceURI(bestVoice.voiceURI);
        }
      }
    };

    initializeVoices();

    // Load saved texts from localStorage
    const saved = localStorage.getItem('saved-texts');
    if (saved) {
      setSavedTexts(JSON.parse(saved));
    }

  }, [selectedVoiceURI, preferredVoiceType, setSelectedVoiceURI]);

  useEffect(() => {
    if (text.trim()) {
      const sentenceArray = text
        .replace(/([.!?])\s+/g, '$1|')
        .replace(/([.!?])([A-Z])/g, '$1|$2')
        .split('|')
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0);
      setSentences(sentenceArray);
    } else {
      setSentences([]);
    }
  }, [text]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setText(content);
      };
      reader.readAsText(file);
    }
  };

  const saveText = () => {
    if (!text.trim()) return;
    
    const title = prompt('Enter a title for this text:');
    if (!title) return;

    const newSavedText: SavedText = {
      id: Date.now().toString(),
      title,
      content: text,
      createdAt: new Date().toISOString()
    };

    const updatedSaved = [...savedTexts, newSavedText];
    setSavedTexts(updatedSaved);
    localStorage.setItem('saved-texts', JSON.stringify(updatedSaved));
  };

  const loadSavedText = (savedText: SavedText) => {
    setText(savedText.content);
    setShowSaved(false);
    setCurrentSentence(0);
    setIsPlaying(false);
    speechSynthesis.cancel();
  };

  const deleteSavedText = (id: string) => {
    const updatedSaved = savedTexts.filter(t => t.id !== id);
    setSavedTexts(updatedSaved);
    localStorage.setItem('saved-texts', JSON.stringify(updatedSaved));
  };

  const exportAudio = async () => {
    if (sentences.length === 0) return;

    setIsExporting(true);
    try {
      // Simple text export for now - audio export requires server-side processing
      const textContent = sentences.join('\n\n');
      const blob = new Blob([textContent], { type: 'text/plain' });
      saveAs(blob, 'text-to-speech.txt');
    } catch (error) {
      console.error('Error exporting text:', error);
      alert('Could not export text.');
    } finally {
      setIsExporting(false);
    }
  };

  const speakSentence = (index: number) => {
    if (index >= 0 && index < sentences.length) {
      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.rate = playbackSpeed;
      utterance.volume = playbackVolume;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.onend = () => {
        if (index < sentences.length - 1) {
          setCurrentSentence(index + 1);
          speakSentence(index + 1);
        } else {
          setIsPlaying(false);
          setCurrentSentence(0);
        }
      };
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    }
  };

  const toggleSpeech = () => {
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speakSentence(currentSentence);
    }
  };

  const skipForward = () => {
    if (currentSentence < sentences.length - 1) {
      speechSynthesis.cancel();
      setCurrentSentence(prev => prev + 1);
      if (isPlaying) {
        speakSentence(currentSentence + 1);
      }
    }
  };

  const skipBackward = () => {
    if (currentSentence > 0) {
      speechSynthesis.cancel();
      setCurrentSentence(prev => prev - 1);
      if (isPlaying) {
        speakSentence(currentSentence - 1);
      }
    }
  };

  const jumpForward = () => {
    const newIndex = Math.min(sentences.length - 1, currentSentence + 5);
    speechSynthesis.cancel();
    setCurrentSentence(newIndex);
    if (isPlaying) {
      speakSentence(newIndex);
    }
  };

  const jumpBackward = () => {
    const newIndex = Math.max(0, currentSentence - 5);
    speechSynthesis.cancel();
    setCurrentSentence(newIndex);
    if (isPlaying) {
      speakSentence(newIndex);
    }
  };

  const handleSentenceClick = (index: number) => {
    speechSynthesis.cancel();
    setCurrentSentence(index);
    if (isPlaying) {
      speakSentence(index);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Mobile-optimized Header */}
      <div className={`sticky top-0 z-20 px-4 pt-2 pb-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`rounded-xl shadow-lg p-3 transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate('/')}
                className={`touch-button p-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className={`text-lg sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Text to Speech
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className={`touch-button flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-sm ${
                  darkMode 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                <Mic2 className="w-4 h-4" />
                <span className="hidden sm:inline">Voice</span>
              </button>
              <label className={`touch-button flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                darkMode 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-white hover:bg-gray-100'
              }`}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
                <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
              </label>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`touch-button p-2 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
              >
                {darkMode ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Selector Modal */}
      {showVoiceSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
          <div className={`max-w-md w-full max-h-[80vh] rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Select Voice
                </h2>
                <button
                  onClick={() => setShowVoiceSelector(false)}
                  className={`touch-button p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  ✕
                </button>
              </div>
              <VoiceSelector
                selectedVoiceURI={selectedVoiceURI}
                onVoiceChange={(uri) => {
                  setSelectedVoiceURI(uri);
                  const voice = voiceManager.getVoiceByURI(uri);
                  setSelectedVoice(voice);
                }}
                preferredType={preferredVoiceType}
                onPreferredTypeChange={setPreferredVoiceType}
                darkMode={darkMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Mobile Layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-5rem)] px-4 gap-4 pb-4">
        {/* Text Input Section */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={saveText}
              disabled={!text.trim()}
              className={`touch-button flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm flex-1 ${
                darkMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              Save Text
            </button>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className={`touch-button flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm flex-1 ${
                darkMode 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Saved ({savedTexts.length})
            </button>
            <button
              onClick={exportAudio}
              disabled={!text.trim() || isExporting}
              className={`touch-button flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                darkMode 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {/* Text Input */}
          <div className={`flex-1 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-4 h-full flex flex-col">
              <h2 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Enter Text
              </h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter or paste your text here..."
                className={`flex-1 w-full p-4 rounded-lg border resize-none mobile-input ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 placeholder-gray-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Controls and Text Preview */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          {/* Mobile Controls */}
          <div className={`p-4 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <MobileControls
              isPlaying={isPlaying}
              onTogglePlay={toggleSpeech}
              onSkipBack={skipBackward}
              onSkipForward={skipForward}
              onJumpBack={jumpBackward}
              onJumpForward={jumpForward}
              volume={playbackVolume}
              onVolumeChange={setPlaybackVolume}
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              disabled={!text.trim()}
              darkMode={darkMode}
              showSettings={showSettings}
              onToggleSettings={() => setShowSettings(!showSettings)}
            />
            
            {/* Auto-scroll toggle */}
            <div className="flex justify-center mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-700'}`}>Auto-scroll</span>
              </label>
            </div>
          </div>

          {/* Text Preview */}
          <div className={`flex-1 rounded-xl shadow-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <TextHighlighter
              sentences={sentences}
              currentSentence={currentSentence}
              onSentenceClick={handleSentenceClick}
              darkMode={darkMode}
              autoScroll={autoScroll}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Saved Texts Modal */}
      {showSaved && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`max-w-2xl w-full mx-4 max-h-[80vh] rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Saved Texts
                </h2>
                <button
                  onClick={() => setShowSaved(false)}
                  className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {savedTexts.length > 0 ? (
                  savedTexts.map((savedText) => (
                    <div
                      key={savedText.id}
                      className={`p-4 rounded-lg border ${
                        darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          {savedText.title}
                        </h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadSavedText(savedText)}
                            className={`px-3 py-1 rounded text-sm ${
                              darkMode 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                          >
                            Load
                          </button>
                          <button
                            onClick={() => deleteSavedText(savedText.id)}
                            className={`p-1 rounded ${
                              darkMode 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-red-500 hover:bg-red-600'
                            }`}
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                        {new Date(savedText.createdAt).toLocaleDateString()}
                      </p>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                        {savedText.content.substring(0, 100)}...
                      </p>
                    </div>
                  ))
                ) : (
                  <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No saved texts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}