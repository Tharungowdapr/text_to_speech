import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, Settings, Moon, Sun, SkipBack, SkipForward, Rewind, FastForward, Download, Upload, Save, Trash2 } from 'lucide-react';
import { useStore } from '../store';
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
    autoScroll,
    setAutoScroll
  } = useStore();

  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savedTexts, setSavedTexts] = useState<SavedText[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const speechSynthesis = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      if (selectedVoiceURI && voices.length > 0) {
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) {
          setSelectedVoice(voice);
        }
      } else if (voices.length > 0 && !selectedVoice) {
        setSelectedVoice(voices[0]);
        setSelectedVoiceURI(voices[0].voiceURI);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    // Load saved texts from localStorage
    const saved = localStorage.getItem('saved-texts');
    if (saved) {
      setSavedTexts(JSON.parse(saved));
    }

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI, selectedVoice, setSelectedVoiceURI]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setAudioChunks(chunks);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const exportAudio = async () => {
    if (sentences.length === 0) return;

    try {
      // Create a new MediaRecorder to capture the speech synthesis
      const stream = new MediaStream();
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      stream.addTrack(destination.stream.getAudioTracks()[0]);

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        saveAs(audioBlob, 'text-to-speech.wav');
      };

      mediaRecorder.start();

      // Speak all sentences
      for (let i = 0; i < sentences.length; i++) {
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(sentences[i]);
          utterance.rate = playbackSpeed;
          utterance.volume = playbackVolume;
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
          utterance.onend = () => resolve();
          speechSynthesis.speak(utterance);
        });
      }

      mediaRecorder.stop();
    } catch (error) {
      console.error('Error exporting audio:', error);
      alert('Could not export audio. This feature may not be fully supported in your browser.');
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

  useEffect(() => {
    if (textContainerRef.current && autoScroll) {
      const sentenceElements = textContainerRef.current.children;
      if (sentenceElements[currentSentence]) {
        sentenceElements[currentSentence].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentSentence, autoScroll]);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className={`sticky top-0 z-10 px-4 pt-4 pb-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`rounded-lg shadow-lg p-4 transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className={`p-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Text to Speech
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                darkMode 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-white hover:bg-gray-100'
              }`}>
                <Upload className="w-4 h-4" />
                <span className="text-sm">Upload Text</span>
                <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} />
              </label>
              <button
                onClick={saveText}
                disabled={!text.trim()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  darkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => setShowSaved(!showSaved)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  darkMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                Saved ({savedTexts.length})
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-1.5 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
              >
                {darkMode ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-5rem)] px-4 gap-4 pb-4">
        {/* Left Side - Text Input */}
        <div className="w-1/2 flex flex-col gap-4">
          <div className={`flex-1 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-4 h-full flex flex-col">
              <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Enter Text
              </h2>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter or paste your text here..."
                className={`flex-1 w-full p-4 rounded-lg border resize-none ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 placeholder-gray-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Right Side - Controls and Preview */}
        <div className="w-1/2 flex flex-col gap-4">
          {/* Controls Panel */}
          <div className={`p-4 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex flex-col gap-4">
              {/* Voice Selection */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <select
                  value={selectedVoice?.voiceURI || ''}
                  onChange={(e) => {
                    const voice = availableVoices.find(v => v.voiceURI === e.target.value);
                    if (voice) {
                      setSelectedVoice(voice);
                      setSelectedVoiceURI(voice.voiceURI);
                    }
                  }}
                  className={`px-3 py-1.5 rounded border ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Playback Controls */}
              <div className="flex justify-center gap-2">
                <button
                  onClick={jumpBackward}
                  disabled={!text.trim() || currentSentence === 0}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Rewind className="w-5 h-5" />
                </button>
                <button
                  onClick={skipBackward}
                  disabled={!text.trim() || currentSentence === 0}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleSpeech}
                  disabled={!text.trim()}
                  className={`p-3 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
                <button
                  onClick={skipForward}
                  disabled={!text.trim() || currentSentence === sentences.length - 1}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={jumpForward}
                  disabled={!text.trim() || currentSentence === sentences.length - 1}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FastForward className="w-5 h-5" />
                </button>
              </div>

              {/* Volume, Speed, and Export Controls */}
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Volume2 className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={playbackVolume}
                    onChange={(e) => setPlaybackVolume(parseFloat(e.target.value))}
                    className="w-24"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Settings className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className={`px-2 py-1 rounded border transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="1.75">1.75x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
                <button
                  onClick={exportAudio}
                  disabled={!text.trim()}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors text-sm ${
                    darkMode 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              {/* Auto-scroll toggle */}
              <div className="flex justify-center">
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
          </div>

          {/* Text Preview */}
          <div className={`flex-1 p-4 rounded-lg shadow-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {sentences.length > 0 ? (
              <div 
                ref={textContainerRef}
                className={`h-full overflow-y-auto pr-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                {sentences.map((sentence, index) => (
                  <div
                    key={index}
                    onClick={() => handleSentenceClick(index)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      index === currentSentence
                        ? 'bg-blue-500 text-white'
                        : darkMode
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {sentence}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Enter text to start
                </p>
              </div>
            )}
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