import './App.css';
import { useState } from 'react';
import { VoiceButton } from './components/VoiceButton';

function App() {
  const [recognizedText, setRecognizedText] = useState('');

  return (
    <div className="app">
      <h1>AI Vision Dialogue</h1>
      <p>摄像头授权后即可开启 AI 视觉对话</p>
      <VoiceButton onTranscript={(text) => setRecognizedText((prev) => prev + text)} />
      <div className="recognized-text">
        <strong>识别结果：</strong>
        <p>{recognizedText || '等待语音输入...'}</p>
      </div>
    </div>
  );
}

export default App;
