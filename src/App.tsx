import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { LandingPage } from './components/LandingPage';
import { RoomPage } from './components/RoomPage';
import { RecordingPage } from './components/RecordingPage';
import './styles/index.css';

function App() {
  const { user, room } = useStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-studio-bg">
        <div className="animate-pulse text-studio-accent text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              room ? <RoomPage /> : <LandingPage />
            ) : (
              <LandingPage />
            )
          }
        />
        <Route
          path="/room/:roomId"
          element={user ? (room ? <RoomPage /> : <Navigate to="/" replace />) : <Navigate to="/" replace />}
        />
        <Route
          path="/recording/:sessionId"
          element={user ? <RecordingPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;