import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Book, Clock, Trash2 } from 'lucide-react';
import { useStore } from '../store';

declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
      };
    };
  }
}

export function Home() {
  const navigate = useNavigate();
  const { darkMode, setDarkMode, recentPDFs, addRecentPDF, removeRecentPDF } = useStore();

  const handleFileSelect = async () => {
    try {
      if (window.electron) {
        // Electron environment
        const result = await window.electron.ipcRenderer.invoke('open-file-dialog');
        if (result) {
          const { name, buffer } = result;
          const file = new File([buffer], name, { type: 'application/pdf' });
          handleSelectedFile(file);
        }
      } else {
        // Browser environment fallback
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            handleSelectedFile(file);
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      alert('Error selecting file. Please try again.');
    }
  };

  const handleSelectedFile = (file: File) => {
    const pdfData = {
      id: Date.now().toString(),
      name: file.name,
      lastOpened: new Date().toISOString(),
      file: file
    };
    addRecentPDF(pdfData);
    navigate('/reader', { state: { pdfFile: file } });
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            PDF to Audio Converter
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
          >
            {darkMode ? '🌞' : '🌙'}
          </button>
        </div>

        {/* Upload Section */}
        <div className={`mb-12 p-8 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg text-center`}>
          <Book className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
          <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            Convert PDF to Audio
          </h2>
          <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Upload a PDF file to convert it to audio. You can control the playback speed and choose different voices.
          </p>
          <button
            onClick={handleFileSelect}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg cursor-pointer transition-colors ${
              darkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <FileUp className="w-5 h-5" />
            <span>Select PDF</span>
          </button>
        </div>

        {/* Recent PDFs */}
        <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg p-6`}>
          <div className="flex items-center gap-2 mb-6">
            <Clock className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Recent PDFs
            </h2>
          </div>
          
          {recentPDFs.length > 0 ? (
            <div className="space-y-4">
              {recentPDFs.map((pdf) => (
                <div
                  key={pdf.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                  } transition-colors`}
                >
                  <div className="flex items-center gap-4">
                    <Book className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                    <div>
                      <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                        {pdf.name}
                      </h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Last opened: {new Date(pdf.lastOpened).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/reader', { state: { pdfFile: pdf.file } })}
                      className={`px-3 py-1.5 rounded ${
                        darkMode 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      } text-white text-sm`}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => removeRecentPDF(pdf.id)}
                      className={`p-1.5 rounded ${
                        darkMode 
                          ? 'bg-gray-600 hover:bg-gray-500' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No recent PDFs
            </p>
          )}
        </div>
      </div>
    </div>
  );
}