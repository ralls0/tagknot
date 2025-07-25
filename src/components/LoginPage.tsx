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
          <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg">
            <path d="M533.5 278.4c0-17.5-1.6-34.3-4.7-50.5H272v95.5h146.9c-6.3 33.7-25 62.2-53.3 81.3v67h85.9c50.3-46.4 81.0-114.7 81.0-193.3z" fill="#4285F4"/>
            <path d="M272 544.3c72.6 0 133.5-24.1 178-65.4l-85.9-67c-23.9 16-54.5 25.3-92.1 25.3-70.9 0-131-47.9-152.5-112.1H31.5v70.7c44.2 87.6 134.2 148.5 240.5 148.5z" fill="#34A853"/>
            <path d="M119.5 325.1c-10.1-30-10.1-62.4 0-92.4v-70.7H31.5C11.4 200.6 0 240.1 0 272.2s11.4 71.6 31.5 110.2l88-57.3z" fill="#FBBC05"/>
            <path d="M272 107.7c39.6 0 75.2 13.6 103.2 40.4l77.4-77.4C405.4 25.2 344.6 0 272 0 165.8 0 75.8 60.9 31.5 148.5l88 70.7C141 155.6 201.1 107.7 272 107.7z" fill="#EA4335"/>
          </svg>

          Accedi con Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
