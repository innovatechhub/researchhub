import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from './providers/ToastProvider';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
