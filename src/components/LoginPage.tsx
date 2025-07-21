import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import AlertMessage from './AlertMessage';

const LoginPage = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error("Authentication error:", err);
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            setError('Questa email è già in uso.');
            break;
          case 'auth/invalid-email':
            setError('Formato email non valido.');
            break;
          case 'auth/weak-password':
            setError('La password deve essere di almeno 6 caratteri.');
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            setError('Email o password non validi.');
            break;
          case 'auth/too-many-requests':
            setError('Troppi tentativi di accesso. Riprova più tardi.');
            break;
          default:
            setError('Si è verificato un errore sconosciuto.');
        }
      } else {
        setError('Si è verificato un errore sconosciuto.');
      }
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onLoginSuccess();
    } catch (err: any) {
      console.error("Google authentication error:", err);
      setError('Errore durante l\'accesso con Google. Riprova.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          {isRegistering ? 'Registrati' : 'Accedi'}
        </h2>
        <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
              placeholder="La tua email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
              placeholder="La tua password"
              required
            />
          </div>
          {error && <AlertMessage message={error} type="error" />}
          <button
            type="submit"
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
          >
            {isRegistering ? 'Registrati' : 'Accedi'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-gray-700 hover:text-gray-800 text-sm"
          >
            {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
          </button>
        </div>
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative bg-white px-4 text-sm text-gray-500">O</div>
        </div>
        <button
          onClick={handleGoogleAuth}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.27c-.23-.74-.75-1.29-1.46-1.29-1.04 0-1.85.83-1.85 1.85s.81 1.85 1.85 1.85c.67 0 1.1-.28 1.47-.64l1.24 1.25c-.94.92-2.22 1.5-3.59 1.5-2.98 0-5.4-2.42-5.4-5.4s2.42-5.4 5.4-5.4c3.02 0 5.16 2.12 5.16 5.25 0 .33-.03.66-.08.98z" fill="#4285F4" />
            <path d="M22.56 12.23c0-.78-.07-1.5-.18-2.2H12v4.11h6.14c-.26 1.37-.99 2.53-2.12 3.3l3.52 2.72c2.04-1.9 3.22-4.66 3.22-8.13z" fill="#34A853" />
            <path d="M3.52 14.73l-3.52 2.72C2.56 19.34 7.02 22 12 22c3.59 0 6.64-1.2 8.88-3.23l-3.52-2.72c-.99.64-2.22 1.02-3.36 1.02-2.58 0-4.72-1.74-5.49-4.08H3.52z" fill="#FBBC05" />
            <path d="M12 4c1.45 0 2.76.5 3.79 1.48l3.15-3.15C18.22 1.34 15.22 0 12 0 7.02 0 2.56 2.66 0 6.27l3.52 2.72C4.28 6.74 7.32 4 12 4z" fill="#EA4335" />
          </svg>
          Accedi con Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
