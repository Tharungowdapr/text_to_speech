import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PDFReader } from './pages/PDFReader';
import { TextToSpeech } from './pages/TextToSpeech';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<PDFReader />} />
        <Route path="/text-to-speech" element={<TextToSpeech />} />
      </Routes>
    </Router>
  );
}

export default App;