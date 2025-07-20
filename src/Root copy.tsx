import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User // Importa il tipo User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  deleteDoc,
  orderBy,
  writeBatch,
  Timestamp // Importa il tipo Timestamp
} from 'firebase/firestore';
// Rimossi gli import di Firebase Storage in quanto le immagini saranno Base64

// Inizializzazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDU3l6vaw7L2jcX55eeLHaEjoX5502btyE",
  authDomain: "tagknot-app.firebaseapp.com",
  projectId: "tagknot-app",
  storageBucket: "tagknot-app.firebasestorage.app",
  messagingSenderId: "717671583198",
  appId: "1:717671583198:web:6b3c0c6456801097d4614f",
  measurementId: "G-83BP5N3H03"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Non più necessario per le immagini Base64
const appId = "tagknot-app"; // Hardcoded per produzione

// Chiave API di Google Maps
const GOOGLE_MAPS_API_KEY = "AIzaSyBMWvWbkx9Y8bUtzHJaPwUz1oj4jByp500";

// Interfacce per la tipizzazione
interface UserProfileData { // Dati direttamente nel documento Firestore
  type: 'user'; // Discriminator property
  email: string | null;
  username: string;
  profileTag: string;
  profileImage: string; // Sarà una stringa Base64
  followers: string[];
  following: string[];
  createdAt: Timestamp;
}

interface UserProfile extends UserProfileData { // Profilo utente completo con ID documento
  id: string;
}

interface EventData { // Dati direttamente nel documento Firestore
  type: 'event'; // Discriminator property
  tag: string;
  description: string;
  coverImage: string; // Sarà una stringa Base64
  date: string;
  time: string;
  locationName: string;
  locationCoords: { lat: number; lng: number } | null;
  taggedUsers: string[];
  isPublic: boolean;
  creatorId: string;
  likes: string[];
  commentCount: number;
  createdAt: Timestamp;
}

interface EventType extends EventData { // Tipo Evento completo con ID documento
  id: string;
}

interface CommentData { // Dati direttamente nel documento Firestore
  userId: string;
  username: string;
  text: string;
  createdAt: Timestamp;
}

interface CommentType extends CommentData { // Tipo Commento completo con ID documento
  id: string;
}

interface NotificationData { // Dati direttamente nel documento Firestore
  type: 'like' | 'comment' | 'share';
  fromUserId: string;
  fromUsername: string;
  eventId: string;
  eventTag: string;
  message: string;
  createdAt: Timestamp;
  read: boolean;
  imageUrl: string; // Sarà una stringa Base64
}

interface NotificationType extends NotificationData { // Tipo Notifica completo con ID documento
  id: string;
}

interface AuthContextType {
  currentUser: User | null;
  userId: string | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

// Funzione per ridimensionare e convertire un'immagine in Base64
const resizeAndConvertToBase64 = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // Converti in JPEG con qualità 0.8
        } else {
          reject(new Error("Impossibile ottenere il contesto del canvas."));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Contesto di Autenticazione
const AuthContext = createContext<AuthContextType | null>(null);

// Provider di Autenticazione
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setUserId(user.uid);

        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          const baseUsername = user.email ? user.email.split('@')[0] : `user_${user.uid.substring(0, 8)}`;
          const baseProfileTag = `tag_${user.uid.substring(0, 8)}`;

          const newProfileData: UserProfileData = {
            type: 'user',
            email: user.email,
            username: baseUsername,
            profileTag: baseProfileTag,
            profileImage: '',
            followers: [],
            following: [],
            createdAt: serverTimestamp() as Timestamp,
          };
          await setDoc(userDocRef, newProfileData);
          setUserProfile({ id: user.uid, ...newProfileData });
        } else {
          setUserProfile({ id: user.uid, ...(userDocSnap.data() as UserProfileData) });
        }

        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile({ id: docSnap.id, ...(docSnap.data() as UserProfileData) });
          }
        });
        setLoading(false); // Imposta loading a false una volta che lo stato utente e il profilo sono stati gestiti
        return unsubscribeProfile;
      } else {
        setCurrentUser(null);
        setUserId(null);
        setUserProfile(null);
        setLoading(false); // Imposta loading a false anche se nessun utente è loggato
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userId, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook per usare il contesto di autenticazione
const useAuth = () => {
  return useContext(AuthContext);
};

// Componente di Login
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
      setError(err.message);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
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
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
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
            <path d="M12.24 10.27c-.23-.74-.75-1.29-1.46-1.29-1.04 0-1.85.83-1.85 1.85s.81 1.85 1.85 1.85c.67 0 1.1-.28 1.47-.64l1.24 1.25c-.94.92-2.22 1.5-3.59 1.5-2.98 0-5.4-2.42-5.4-5.4s2.42-5.4 5.4-5.4c3.02 0 5.16 2.12 5.16 5.25 0 .33-.03.66-.08.98z" fill="#4285F4"/>
            <path d="M22.56 12.23c0-.78-.07-1.5-.18-2.2H12v4.11h6.14c-.26 1.37-.99 2.53-2.12 3.3l3.52 2.72c2.04-1.9 3.22-4.66 3.22-8.13z" fill="#34A853"/>
            <path d="M3.52 14.73l-3.52 2.72C2.56 19.34 7.02 22 12 22c3.59 0 6.64-1.2 8.88-3.23l-3.52-2.72c-.99.64-2.22 1.02-3.36 1.02-2.58 0-4.72-1.74-5.49-4.08H3.52z" fill="#FBBC05"/>
            <path d="M12 4c1.45 0 2.76.5 3.79 1.48l3.15-3.15C18.22 1.34 15.22 0 12 0 7.02 0 2.56 2.66 0 6.27l3.52 2.72C4.28 6.74 7.32 4 12 4z" fill="#EA4335"/>
          </svg>
          Accedi con Google
        </button>
      </div>
    </div>
  );
};

// Componente di Navigazione
const Navbar = ({ onNavigate, onLogout, unreadNotificationsCount }: { onNavigate: (page: string, id?: string | null) => void; onLogout: () => void; unreadNotificationsCount: number }) => {
  const { userId, userProfile } = useAuth() || {};
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleSettingsMenu = () => {
    setShowSettingsMenu(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuItemClick = (page: string) => {
    onNavigate(page);
    setShowSettingsMenu(false);
  };

  return (
    <>
      {/* Top Navbar for Desktop/Tablet */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50 py-3 px-4 flex items-center justify-between md:flex">
        {/* User Info on Left (always visible) */}
        <div className="flex items-center space-x-3">
          {userProfile && userProfile.profileImage ? (
            <img
              src={userProfile.profileImage}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-gray-400"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://placehold.co/32x32/CCC/333?text=${userProfile.username ? userProfile.username[0].toUpperCase() : 'U'}`; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-sm">
              {userProfile && userProfile.username ? userProfile.username[0].toUpperCase() : 'U'}
            </div>
          )}
          <span className="font-semibold text-gray-800 hidden sm:block">{userProfile?.username || 'Caricamento...'}</span>
        </div>

        {/* Navigation Buttons (centered, hidden on mobile) */}
        <div className="hidden md:flex justify-center space-x-6">
          <button onClick={() => handleMenuItemClick('home')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            <span className="text-xs mt-1 hidden md:block">Home</span>
          </button>
          <button onClick={() => handleMenuItemClick('createEvent')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span className="text-xs mt-1 hidden md:block">Crea</span>
          </button>
          <button onClick={() => handleMenuItemClick('search')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <span className="text-xs mt-1 hidden md:block">Cerca</span>
          </button>
          <button onClick={() => handleMenuItemClick('myProfile')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            <span className="text-xs mt-1 hidden md:block">Profilo</span>
          </button>
          <button onClick={() => handleMenuItemClick('notifications')} className="relative flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.002 2.002 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                {unreadNotificationsCount}
              </span>
            )}
            <span className="text-xs mt-1 hidden md:block">Notifiche</span>
          </button>
        </div>

        {/* Settings Menu on Right (always visible) */}
        <div className="relative" ref={menuRef}>
          <button onClick={toggleSettingsMenu} className="text-gray-600 hover:text-gray-800 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2z"></path></svg>
          </button>
          {showSettingsMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 border border-gray-200">
              <button
                onClick={() => handleMenuItemClick('settings')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Impostazioni
              </button>
              <button
                onClick={onLogout}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Esci
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Navbar for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-sm z-50 py-2 flex justify-around md:hidden">
        <button onClick={() => handleMenuItemClick('home')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          <span className="text-xs mt-1">Home</span>
        </button>
        <button onClick={() => handleMenuItemClick('createEvent')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="text-xs mt-1">Crea</span>
        </button>
        <button onClick={() => handleMenuItemClick('search')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <span className="text-xs mt-1">Cerca</span>
        </button>
        <button onClick={() => handleMenuItemClick('myProfile')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span className="text-xs mt-1">Profilo</span>
        </button>
        <button onClick={() => handleMenuItemClick('notifications')} className="relative flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.002 2.002 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                {unreadNotificationsCount}
              </span>
            )}
          <span className="text-xs mt-1">Notifiche</span>
        </button>
      </nav>
    </>
  );
};

// Componente Card Evento
const EventCard = ({ event, currentUser, onFollowToggle, followingUsers, onEdit, onDelete, onRemoveTag, isProfileView = false, onLikeToggle, onShowEventDetail }: { event: EventType; currentUser: User | null; onFollowToggle: (creatorId: string, isFollowing: boolean) => Promise<void>; followingUsers: string[]; onEdit: (event: EventType) => void; onDelete: (eventId: string, isPublic: boolean) => Promise<void>; onRemoveTag: (eventId: string) => Promise<void>; isProfileView?: boolean; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; }) => {
  const [creatorUsername, setCreatorUsername] = useState('Caricamento...');
  const [creatorProfileImage, setCreatorProfileImage] = useState('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const isFollowing = followingUsers.includes(event.creatorId);
  const isOwnEvent = currentUser && currentUser.uid === event.creatorId;
  const isTaggedEvent = currentUser && event.taggedUsers && event.taggedUsers.includes(currentUser.email?.split('@')[0] || '');
  const isLiked = !!(currentUser && event.likes && event.likes.includes(currentUser.uid)); // Forza a boolean

  useEffect(() => {
    const fetchCreatorData = async () => {
      if (event.creatorId) {
        const userProfileRef = doc(db, `artifacts/${appId}/users/${event.creatorId}/profile/data`);
        const userDocSnap = await getDoc(userProfileRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data() as UserProfileData;
          setCreatorUsername(data.username || 'Utente Sconosciuto');
          setCreatorProfileImage(data.profileImage || '');
        } else {
          setCreatorUsername('Utente Sconosciuto');
          setCreatorProfileImage('');
        }
      }
    };
    fetchCreatorData();
  }, [event.creatorId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const defaultCoverImage = event.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(event.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {creatorProfileImage ? (
            <img
              src={creatorProfileImage}
              alt="Creator Profile"
              className="w-10 h-10 rounded-full object-cover border border-gray-400"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://placehold.co/40x40/CCC/333?text=${creatorUsername[0].toUpperCase()}`; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-lg">
              {creatorUsername[0].toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-gray-800">{creatorUsername}</span>
        </div>
        {isProfileView && isOwnEvent && (
          <div className="relative" ref={optionsMenuRef}>
            <button onClick={() => setShowOptionsMenu(prev => !prev)} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2z"></path></svg>
            </button>
            {showOptionsMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg py-1 border border-gray-200 z-10">
                <button onClick={() => { onEdit(event); setShowOptionsMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Modifica
                </button>
                <button onClick={() => { onDelete(event.id, event.isPublic); setShowOptionsMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Elimina
                </button>
              </div>
            )}
          </div>
        )}
        {isProfileView && !isOwnEvent && isTaggedEvent && (
            <button onClick={() => onRemoveTag(event.id)} className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition-colors duration-200">
                Rimuovi Tag
            </button>
        )}
      </div>

      {event.coverImage ? (
        <img
          src={event.coverImage}
          alt={event.tag}
          className="w-full h-64 object-cover"
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultCoverImage; }}
        />
      ) : (
        <img
          src={defaultCoverImage}
          alt={event.tag}
          className="w-full h-64 object-cover"
        />
      )}
      <div className="p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">#{event.tag}</h3>
          {!isOwnEvent && (
            <button
              onClick={() => onFollowToggle(event.creatorId, isFollowing)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isFollowing ? 'bg-gray-300 text-gray-800' : 'bg-gray-800 text-white hover:bg-gray-900'
              } transition-colors duration-200`}
            >
              {isFollowing ? 'Segui già' : 'Segui'}
            </button>
          )}
        </div>
        {event.description && <p className="text-gray-700 text-sm mb-3">{event.description}</p>}
        <div className="text-gray-600 text-sm space-y-1">
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            {new Date(event.date).toLocaleDateString('it-IT')} alle {event.time}
          </p>
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            {event.locationName}
          </p>
          {event.taggedUsers && event.taggedUsers.length > 0 && (
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              Taggati: {event.taggedUsers.join(', ')}
            </p>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {event.isPublic ? 'Pubblico' : 'Privato'}
        </p>
        <div className="flex items-center justify-around mt-4 border-t border-gray-200 pt-4">
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onLikeToggle(event.id, isLiked); }} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
            <svg className={`w-6 h-6 ${isLiked ? 'text-red-500' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            <span className="text-sm">{event.likes ? event.likes.length : 0}</span>
          </button>
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onShowEventDetail(event); }} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            <span className="text-sm">{event.commentCount ? event.commentCount : 0}</span>
          </button>
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onShowEventDetail(event, undefined, undefined, true); }} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
            <span className="text-sm">Condividi</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente Home (Feed)
const HomePage = ({ onShowEventDetail, onLikeToggle }: { onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; }) => {
  const { currentUser, userId } = useAuth() || {};
  const [events, setEvents] = useState<EventType[]>([]);
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!userId) {
        setLoadingEvents(false);
        return;
    }

    // Listener per il profilo utente corrente per ottenere gli utenti seguiti
    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    const unsubscribeProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (docSnap.exists()) {
        setFollowingUsers((docSnap.data() as UserProfileData).following || []);
      }
    });

    // Query per tutti gli eventi pubblici
    const publicEventsQuery = query(
      collection(db, `artifacts/${appId}/public/data/events`),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc') // Ordina per data di creazione, i più recenti prima
    );

    const unsubscribePublicEvents = onSnapshot(publicEventsQuery, (snapshot) => {
      const fetchedPublicEvents = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as EventData) }));

      // Filtra gli eventi per includere solo quelli creati dall'utente o dagli utenti seguiti
      // Se followingUsers è vuoto, mostra comunque tutti gli eventi pubblici (già filtrati dalla query)
      const filteredEvents = fetchedPublicEvents.filter(event =>
        followingUsers.includes(event.creatorId) || event.creatorId === userId
      );

      // Se non ci sono eventi da utenti seguiti o propri, ma ci sono eventi pubblici,
      // mostra tutti gli eventi pubblici. Questo assicura che il feed non sia mai vuoto
      // se ci sono eventi pubblici disponibili.
      if (filteredEvents.length === 0 && fetchedPublicEvents.length > 0) {
        setEvents(fetchedPublicEvents);
      } else {
        setEvents(filteredEvents);
      }
      setLoadingEvents(false);
    }, (error) => {
      console.error("Errore nel recupero degli eventi:", error);
      setLoadingEvents(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribePublicEvents();
    };
  }, [userId, followingUsers]); // Dipende da userId e followingUsers

  const handleFollowToggle = async (creatorId: string, isFollowing: boolean) => {
    if (!currentUser || !userId || creatorId === userId) return;

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    const creatorProfileRef = doc(db, `artifacts/${appId}/users/${creatorId}/profile/data`);

    try {
      if (isFollowing) {
        await updateDoc(userProfileRef, {
          following: arrayRemove(creatorId)
        });
        await updateDoc(creatorProfileRef, {
          followers: arrayRemove(userId)
        });
      } else {
        await updateDoc(userProfileRef, {
          following: arrayUnion(creatorId)
        });
        await updateDoc(creatorProfileRef, {
          followers: arrayUnion(userId)
        });
      }
    } catch (error) {
      console.error("Errore nel seguire/smettere di seguire:", error);
    }
  };

  if (loadingEvents) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
        <p className="ml-4 text-xl">Caricamento eventi...</p>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800">
      <div className="flex flex-col items-center gap-6 p-4 max-w-xl mx-auto">
        {events.length === 0 ? (
          <p className="text-center text-gray-600 mt-10">Nessun evento disponibile nel tuo feed. Inizia a seguire qualcuno o crea il tuo primo evento!</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="w-full">
              <EventCard
                event={event}
                currentUser={currentUser || null} // Passa currentUser o null
                onFollowToggle={handleFollowToggle}
                followingUsers={followingUsers}
                onLikeToggle={onLikeToggle}
                onShowEventDetail={onShowEventDetail}
                onEdit={async () => {}}
                onDelete={async () => {}}
                onRemoveTag={async () => {}}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Componente Creazione Evento
const CreateEventPage = ({ onEventCreated, eventToEdit, onCancelEdit }: { onEventCreated: () => void; eventToEdit: EventType | null; onCancelEdit: () => void; }) => {
  const { currentUser, userId, userProfile } = useAuth() || {};
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState(''); // Per l'URL dell'immagine esistente o caricata
  const [coverImageLink, setCoverImageLink] = useState(''); // Per l'URL inserito dall'utente
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [taggedUsers, setTaggedUsers] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(-1);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);


  useEffect(() => {
    if (eventToEdit) {
      setTag(eventToEdit.tag.startsWith('#') ? eventToEdit.tag.substring(1) : eventToEdit.tag || '');
      setDescription(eventToEdit.description || '');
      setCoverImageUrl(eventToEdit.coverImage || '');
      setCoverImageLink(eventToEdit.coverImage || ''); // Pre-popola anche il campo link
      setDate(eventToEdit.date || '');
      setTime(eventToEdit.time || '');
      setLocationName(eventToEdit.locationName || '');
      setLocationCoords(eventToEdit.locationCoords || null);
      setTaggedUsers(eventToEdit.taggedUsers ? eventToEdit.taggedUsers.join(', ') : '');
      setIsPublic(eventToEdit.isPublic);
    } else {
      setTag('');
      setDescription('');
      setCoverImageFile(null);
      setCoverImageUrl('');
      setCoverImageLink('');
      setDate('');
      setTime('');
      setLocationSearch('');
      setLocationName('');
      setLocationCoords(null);
      setTaggedUsers('');
      setIsPublic(true);
    }
  }, [eventToEdit]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (locationSearch.length > 2) {
        setLoadingLocationSuggestions(true);
        try {
          const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(locationSearch)}&key=${GOOGLE_MAPS_API_KEY}`);
          const data = await response.json();
          if (data.predictions) {
            setLocationSuggestions(data.predictions.map((p: any) => ({
              description: p.description,
              place_id: p.place_id
            })));
          } else {
            setLocationSuggestions([]);
          }
        } catch (error) {
          console.error("Error fetching place suggestions:", error);
          setMessage('Errore nel recupero dei suggerimenti di posizione.');
          setMessageType('error');
          setLocationSuggestions([]);
        } finally {
          setLoadingLocationSuggestions(false);
        }
      } else {
        setLocationSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [locationSearch]);

  const handleSelectLocation = async (suggestion: { description: string; place_id: string }) => {
    setLocationSearch(suggestion.description);
    setLocationName(suggestion.description);
    setLocationSuggestions([]);
    setSelectedLocationIndex(-1);
    setMessage('');
    setMessageType('');

    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${suggestion.place_id}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setLocationCoords(data.results[0].geometry.location);
      } else {
        setMessage('Impossibile ottenere le coordinate per la posizione selezionata.');
        setMessageType('error');
        setLocationCoords(null);
      }
    } catch (error) {
      console.error("Error fetching geocode for place_id:", error);
      setMessage('Errore nel recupero delle coordinate di posizione.');
      setMessageType('error');
      setLocationCoords(null);
    }
  };

  const handleKeyDownOnLocationSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedLocationIndex((prev: number) => Math.min(prev + 1, locationSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedLocationIndex((prev: number) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedLocationIndex !== -1) {
      e.preventDefault();
      handleSelectLocation(locationSuggestions[selectedLocationIndex]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userId) {
      setMessage('Devi essere loggato per creare/modificare un evento.');
      setMessageType('error');
      return;
    }

    if (!tag) {
      setMessage('Il Tag (Titolo Evento) è obbligatorio.');
      setMessageType('error');
      return;
    }
    if (!date || !time) {
      setMessage('Per favore, compila tutti i campi obbligatori (Data, Ora).');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    let finalCoverImageUrl = '';

    if (coverImageLink) {
      // Se è stato fornito un link, usalo direttamente
      finalCoverImageUrl = coverImageLink;
    } else if (coverImageFile) {
      // Altrimenti, se è stato caricato un file, ridimensionalo e convertilo in Base64
      setIsUploadingImage(true);
      try {
        finalCoverImageUrl = await resizeAndConvertToBase64(coverImageFile, 800, 600); // Max 800px width, 600px height
      } catch (uploadError) {
        console.error("Errore nel caricamento dell'immagine:", uploadError);
        setMessage('Errore nel caricamento dell\'immagine. Riprova.');
        setMessageType('error');
        setIsSubmitting(false);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    } else if (eventToEdit && eventToEdit.coverImage) {
      // Se è in modalità modifica e non è stata caricata una nuova immagine o link, mantieni quella esistente
      finalCoverImageUrl = eventToEdit.coverImage;
    }

    try {
      const eventData: EventData = {
        type: 'event', // Discriminator
        tag: tag.startsWith('#') ? tag : `#${tag}`,
        description,
        coverImage: finalCoverImageUrl,
        date,
        time,
        locationName,
        locationCoords,
        taggedUsers: taggedUsers.split(',').map(u => u.trim()).filter(u => u),
        isPublic,
        creatorId: userId,
        likes: eventToEdit ? eventToEdit.likes : [], // Mantieni i like esistenti in modifica
        commentCount: eventToEdit ? eventToEdit.commentCount : 0, // Mantieni il conteggio commenti esistente
        createdAt: eventToEdit ? eventToEdit.createdAt : serverTimestamp() as Timestamp // Mantieni data di creazione in modifica
      };

      if (eventToEdit) {
        const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, eventToEdit.id);
        const privateEventRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventToEdit.id);

        await updateDoc(publicEventRef, { ...eventData }); // Spredding per updateDoc
        await updateDoc(privateEventRef, { ...eventData }); // Spredding per updateDoc
        setMessage('Evento modificato con successo!');
      } else {
        let newEventRef;
        if (isPublic) {
          newEventRef = await addDoc(collection(db, `artifacts/${appId}/public/data/events`), eventData);
        }
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
        setMessage('Evento creato con successo!');
      }
      setMessageType('success');
      onEventCreated();
    } catch (error) {
      console.error("Errore nella creazione/modifica dell'evento:", error);
      setMessage('Errore nella creazione/modifica dell\'evento: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">{eventToEdit ? 'Modifica Evento' : 'Crea Nuovo Evento'}</h1>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200 space-y-6">
        {message && (
          <div className={`p-3 rounded-lg text-center ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tag">Tag (Titolo Evento) <span className="text-red-500">*</span></label>
          <input
            type="text"
            id="tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            placeholder="Es. Concerto Rock, Cena tra amici"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">Descrizione (Opzionale)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            placeholder="Dettagli aggiuntivi sull'evento..."
          ></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="coverImageLink">URL Immagine di Copertina (Opzionale)</label>
          <input
            type="text"
            id="coverImageLink"
            value={coverImageLink}
            onChange={(e) => { setCoverImageLink(e.target.value); setCoverImageFile(null); }} // Clear file if link is typed
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            placeholder="Incolla l'URL di un'immagine"
          />
          <p className="text-center text-gray-500 my-2">-- OPPURE --</p>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="coverImageFile">Carica Immagine di Copertina (Opzionale)</label>
          <input
            type="file"
            id="coverImageFile"
            accept="image/*"
            onChange={(e) => { setCoverImageFile(e.target.files ? e.target.files[0] : null); setCoverImageLink(''); }} // Clear link if file is chosen
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {isUploadingImage && (
            <div className="flex items-center justify-center mt-4 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
              Caricamento immagine...
            </div>
          )}
          {(coverImageUrl && !coverImageFile && !coverImageLink) || (coverImageLink && !coverImageFile) ? (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Immagine attuale:</p>
              <img src={coverImageLink || coverImageUrl} alt="Anteprima copertina" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
            </div>
          ) : coverImageFile && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Anteprima file selezionato:</p>
              <img src={URL.createObjectURL(coverImageFile)} alt="Anteprima copertina" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date">Data <span className="text-red-500">*</span></label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="time">Ora <span className="text-red-500">*</span></label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="locationSearch">Ricerca Posizione (Opzionale)</label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="locationSearch"
              value={locationSearch}
              onChange={(e) => { setLocationSearch(e.target.value); setSelectedLocationIndex(-1); }}
              onKeyDown={handleKeyDownOnLocationSearch}
              className="flex-grow px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
              placeholder="Cerca su Google Maps..."
            />
          </div>
          {loadingLocationSuggestions && (
            <div className="flex items-center justify-center mt-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 mr-2"></div>
              Caricamento suggerimenti...
            </div>
          )}
          {locationSuggestions.length > 0 && (
            <ul className="bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
              {locationSuggestions.map((suggestion, index) => (
                <li
                  key={suggestion.place_id}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${index === selectedLocationIndex ? 'bg-gray-100' : ''}`}
                  onClick={() => handleSelectLocation(suggestion)}
                >
                  {suggestion.description}
                </li>
              ))}
            </ul>
          )}
          {locationName && (
            <p className="text-sm text-gray-600 mt-2">Posizione selezionata: <span className="font-semibold">{locationName}</span></p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taggedUsers">Tagga Utenti (separati da virgola)</label>
          <input
            type="text"
            id="taggedUsers"
            value={taggedUsers}
            onChange={(e) => setTaggedUsers(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            placeholder="username1, username2"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-5 w-5 text-gray-700 rounded border-gray-300 focus:ring-gray-500 bg-gray-50"
          />
          <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
            Rendi l'evento pubblico (visibile nel feed degli utenti che ti seguono)
          </label>
        </div>
        <button
          type="submit"
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
          disabled={isSubmitting || isUploadingImage}
        >
          {isSubmitting || isUploadingImage ? (eventToEdit ? 'Salvataggio...' : 'Creazione in corso...') : (eventToEdit ? 'Salva Modifiche' : 'Crea Evento')}
        </button>
        {eventToEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg mt-4"
          >
            Annulla
          </button>
        )}
      </form>
    </div>
  );
};

// Componente per visualizzare un profilo utente (proprio o di altri)
const UserProfileDisplay = ({ userIdToDisplay, onNavigate, onEditEvent, onDeleteEvent, onRemoveTagFromEvent, onShowEventDetail, onLikeToggle }: { userIdToDisplay: string; onNavigate: (page: string, id?: string | null) => void; onEditEvent: (event: EventType) => void; onDeleteEvent: (eventId: string, isPublic: boolean) => Promise<void>; onRemoveTagFromEvent: (eventId: string) => Promise<void>; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; }) => {
  const { currentUser, userId: currentUserId, userProfile: currentUserProfile } = useAuth() || {};
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myEvents, setMyEvents] = useState<EventType[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<EventType[]>([]);
  const [activeTab, setActiveTab] = useState('myEvents');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMyEvents, setLoadingMyEvents] = useState(true);
  const [loadingTaggedEvents, setLoadingTaggedEvents] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!userIdToDisplay) {
      setLoadingProfile(false);
      setLoadingMyEvents(false);
      setLoadingTaggedEvents(false);
      return;
    }

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userIdToDisplay}/profile/data`);
    const unsubscribeProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...(docSnap.data() as UserProfileData) });
        if (currentUserProfile && currentUserProfile.following) {
          setIsFollowing(currentUserProfile.following.includes(userIdToDisplay));
        }
      } else {
        setProfile(null);
      }
      setLoadingProfile(false);
    });

    // Per il proprio profilo, mostra tutti gli eventi. Per altri, solo quelli pubblici.
    const myEventsQuery = query(
      collection(db, `artifacts/${appId}/users/${userIdToDisplay}/events`)
    );
    const unsubscribeMyEvents = onSnapshot(myEventsQuery, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as EventData) }));
      setMyEvents(fetchedEvents.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()));
      setLoadingMyEvents(false);
    });

    const taggedEventsQuery = query(
      collection(db, `artifacts/${appId}/public/data/events`),
      where('taggedUsers', 'array-contains', profile?.username || currentUser?.email?.split('@')[0] || `user_${userIdToDisplay.substring(0, 8)}`)
    );
    const unsubscribeTaggedEvents = onSnapshot(taggedEventsQuery, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as EventData) }));
      setTaggedEvents(fetchedEvents.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()));
      setLoadingTaggedEvents(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeMyEvents();
      unsubscribeTaggedEvents();
    };
  }, [userIdToDisplay, currentUser, currentUserProfile, profile?.username]);

  const handleFollowToggle = async () => {
    if (!currentUser || !currentUserId || userIdToDisplay === currentUserId) return;

    const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/data`);
    const targetProfileRef = doc(db, `artifacts/${appId}/users/${userIdToDisplay}/profile/data`);

    try {
      if (isFollowing) {
        await updateDoc(userProfileRef, {
          following: arrayRemove(userIdToDisplay)
        });
        await updateDoc(targetProfileRef, {
          followers: arrayRemove(currentUserId)
        });
      } else {
        await updateDoc(userProfileRef, {
          following: arrayUnion(userIdToDisplay)
        });
        await updateDoc(targetProfileRef, {
          followers: arrayUnion(currentUserId)
        });
      }
    } catch (error) {
      console.error("Errore nel seguire/smettere di seguire:", error);
    }
  };

  const isOwnProfile = currentUserId === userIdToDisplay;

  if (loadingProfile || loadingMyEvents || loadingTaggedEvents) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
        <p className="ml-4 text-xl">Caricamento profilo...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4 text-center">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">Profilo Utente</h1>
        <p className="text-gray-600">Profilo utente non trovato.</p>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          {profile.profileImage ? (
            <img
              src={profile.profileImage}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-gray-500"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://placehold.co/128x128/CCC/333?text=${profile.username ? profile.username[0].toUpperCase() : 'U'}`; }}
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-6xl font-bold text-gray-700 mb-4 border-4 border-gray-500">
              {profile.username ? profile.username[0].toUpperCase() : 'U'}
            </div>
          )}
          <h1 className="text-4xl font-extrabold text-gray-800 mb-2">{profile.username}</h1>
          <p className="text-gray-600 text-lg">@{profile.profileTag}</p>
          <p className="text-gray-500 text-md">{profile.email}</p>
          <div className="flex space-x-6 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold">{profile.followers ? profile.followers.length : 0}</p>
              <p className="text-gray-600 text-sm">Follower</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{profile.following ? profile.following.length : 0}</p>
              <p className="text-gray-600 text-sm">Seguiti</p>
            </div>
          </div>
          {!isOwnProfile && currentUser && (
            <button
              onClick={handleFollowToggle}
              className={`mt-4 px-6 py-2 rounded-full font-bold ${
                isFollowing ? 'bg-gray-300 text-gray-800 hover:bg-gray-400' : 'bg-gray-800 text-white hover:bg-gray-900'
              } transition-colors duration-200 shadow-md`}
            >
              {isFollowing ? 'Smetti di seguire' : 'Segui'}
            </button>
          )}
        </div>

        <div className="border-b border-gray-200 mb-6">
          <div className="flex justify-center space-x-6">
            <button
              onClick={() => setActiveTab('myEvents')}
              className={`py-3 px-6 text-lg font-semibold ${activeTab === 'myEvents' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Eventi Creati ({myEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('taggedEvents')}
              className={`py-3 px-6 text-lg font-semibold ${activeTab === 'taggedEvents' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Eventi Taggati ({taggedEvents.length})
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          {activeTab === 'myEvents' ? (
            myEvents.length === 0 ? (
              <p className="text-center text-gray-600 col-span-full mt-10">Nessun evento creato.</p>
            ) : (
              myEvents.map((event) => (
                <div key={event.id} className="w-full">
                  <EventCard
                    event={event}
                    currentUser={currentUser || null}
                    onFollowToggle={async () => {}}
                    followingUsers={[]}
                    onEdit={onEditEvent}
                    onDelete={onDeleteEvent}
                    isProfileView={true}
                    onLikeToggle={onLikeToggle}
                    onShowEventDetail={onShowEventDetail}
                    onRemoveTag={async () => {}}
                  />
                </div>
              ))
            )
          ) : (
            taggedEvents.length === 0 ? (
              <p className="text-center text-gray-600 col-span-full mt-10">Nessun evento taggato.</p>
            ) : (
              taggedEvents.map((event) => (
                <div key={event.id} className="w-full">
                  <EventCard
                    event={event}
                    currentUser={currentUser || null}
                    onFollowToggle={async () => {}}
                    followingUsers={[]}
                    onRemoveTag={onRemoveTagFromEvent}
                    isProfileView={true}
                    onLikeToggle={onLikeToggle}
                    onShowEventDetail={onShowEventDetail}
                    onEdit={async () => {}}
                    onDelete={async () => {}}
                  />
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};

// Componente Impostazioni
const SettingsPage = ({ onNavigate }: { onNavigate: (page: string, id?: string | null) => void }) => {
  const { userId, userProfile } = useAuth() || {};
  const [username, setUsername] = useState('');
  const [profileTag, setProfileTag] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);


  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username || '');
      setProfileTag(userProfile.profileTag || '');
      setProfileImageUrl(userProfile.profileImage || '');
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setMessage('Devi essere loggato per modificare le impostazioni.');
      setMessageType('error');
      return;
    }

    if (!username || !profileTag) {
      setMessage('Username e Tag Profilo sono obbligatori.');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    let finalProfileImageUrl = profileImageUrl;
    if (profileImageFile) {
      setIsUploadingImage(true);
      try {
        finalProfileImageUrl = await resizeAndConvertToBase64(profileImageFile, 200, 200); // Max 200px for profile image
      } catch (uploadError) {
        console.error("Errore nel caricamento dell'immagine del profilo:", uploadError);
        setMessage('Errore nel caricamento dell\'immagine del profilo. Riprova.');
        setMessageType('error');
        setIsSubmitting(false);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    try {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);

      // NOTA: Per un controllo di unicità globale del profileTag su tutti gli utenti,
      // sarebbe necessaria una Firestore "Collection Group Query" sulla subcollection 'profile'.
      // Questo richiede la creazione di un indice specifico in Firestore.
      // Poiché non possiamo creare indici automaticamente dall'ambiente Canvas,
      // e per evitare errori di permessi/indice, il controllo di unicità è stato rimosso.
      // Se si desidera questa funzionalità in produzione, è necessario creare l'indice manualmente
      // e implementare la query di gruppo.
      // Esempio (richiede indice):
      /*
      if (userProfile && profileTag !== userProfile.profileTag) {
        const q = query(collectionGroup(db, 'profile'), where('profileTag', '==', profileTag));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty && querySnapshot.docs[0].id !== userId) {
          setMessage('Il tag profilo inserito è già in uso. Scegli un tag diverso.');
          setMessageType('error');
          setIsSubmitting(false);
          return;
        }
      }
      */

      await updateDoc(userDocRef, {
        username: username,
        profileTag: profileTag,
        profileImage: finalProfileImageUrl,
      });
      setMessage('Impostazioni aggiornate con successo!');
      setMessageType('success');

    } catch (error) {
      console.error("Errore nell'aggiornamento delle impostazioni:", error);
      setMessage('Errore nell\'aggiornamento delle impostazioni: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        onNavigate('myProfile');
      }, 1500);
    }
  };

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">Impostazioni Profilo</h1>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200 space-y-6">
        {message && (
          <div className={`p-3 rounded-lg text-center ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">Nome Utente</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profileTag">Tag Profilo Unico (es. @tuo_tag)</label>
          <input
            type="text"
            id="profileTag"
            value={profileTag}
            onChange={(e) => setProfileTag(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profileImageFile">Immagine del Profilo</label>
          <input
            type="file"
            id="profileImageFile"
            accept="image/*"
            onChange={(e) => setProfileImageFile(e.target.files ? e.target.files[0] : null)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {isUploadingImage && (
            <div className="flex items-center justify-center mt-4 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
              Caricamento immagine...
            </div>
          )}
          {(profileImageUrl || profileImageFile) && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 mb-2">Anteprima Immagine Profilo (circolare):</p>
              <img
                src={profileImageFile ? URL.createObjectURL(profileImageFile) : profileImageUrl}
                alt="Anteprima profilo"
                className="mx-auto w-32 h-32 rounded-full object-cover border-4 border-gray-300 shadow-md"
                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://placehold.co/128x128/CCC/333?text=${username ? username[0].toUpperCase() : 'U'}`; }}
              />
              <p className="text-xs text-gray-500 mt-2">L'immagine verrà ritagliata per adattarsi al cerchio.</p>
            </div>
          )}
        </div>
        <button
          type="submit"
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
          disabled={isSubmitting || isUploadingImage}
        >
          {isSubmitting || isUploadingImage ? 'Salvataggio...' : 'Salva Impostazioni'}
        </button>
      </form>
    </div>
  );
};

// Share Event Modal Component
const ShareEventModal = ({ event, onClose, onShareSuccess }: { event: EventType; onClose: () => void; onShareSuccess: () => void; }) => {
  const { userId, userProfile } = useAuth() || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        try {
          // Ricerca per username
          const usersQueryByUsername = query(
            collection(db, `artifacts/${appId}/users`),
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff')
          );
          // Ricerca per profileTag (richiederebbe Collection Group Query se il campo è annidato)
          // Poiché profileTag è annidato in profile/data, una query diretta su users non funzionerà
          // senza un Collection Group Query e un indice.
          // Per semplicità e per evitare errori di indice in ambiente Canvas,
          // la ricerca per profileTag è stata omessa o dovrebbe essere implementata con attenzione.
          // Qui, assumiamo che 'username' sia il campo principale per la ricerca utenti.

          const usernameSnapshot = await getDocs(usersQueryByUsername);

          const uniqueUsers = new Map<string, UserProfile>();
          usernameSnapshot.docs.forEach(doc => uniqueUsers.set(doc.id, { id: doc.id, ...(doc.data() as UserProfileData) }));
          // Se si vuole cercare anche per profileTag, e profileTag è in profile/data,
          // sarebbe necessaria una Collection Group Query come:
          // const profileTagSnapshot = await getDocs(query(collectionGroup(db, 'profile'), where('profileTag', '==', searchTerm)));
          // profileTagSnapshot.docs.forEach(doc => uniqueUsers.set(doc.ref.parent.parent?.id || '', { id: doc.ref.parent.parent?.id || '', ...(doc.data() as UserProfileData) }));

          setSearchResults(Array.from(uniqueUsers.values()).filter(user => user.id !== userId));
        } catch (error) {
          console.error("Error searching users for sharing:", error);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, userId]);

  const handleToggleUserSelection = (user: UserProfile) => {
    setSelectedUsers(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      setMessage('Seleziona almeno un utente per condividere.');
      setMessageType('error');
      return;
    }
    setIsSharing(true);
    setMessage('');
    setMessageType('');

    try {
      for (const user of selectedUsers) {
        if (!userProfile) continue;
        const notificationData: NotificationData = {
          type: 'share',
          fromUserId: userId || '',
          fromUsername: userProfile.username,
          eventId: event.id,
          eventTag: event.tag,
          message: `${userProfile.username} ha condiviso un evento con te: #${event.tag}`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: event.coverImage || '',
        };
        await addDoc(collection(db, `artifacts/${appId}/users/${user.id}/notifications`), notificationData);
      }
      setMessage('Evento condiviso con successo!');
      setMessageType('success');
      onShareSuccess();
    } catch (error) {
      console.error("Error sharing event:", error);
      setMessage('Errore durante la condivisione dell\'evento.');
      setMessageType('error');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Condividi Evento: #{event.tag}</h2>

        {message && (
          <div className={`p-3 rounded-lg text-center mb-4 ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Cerca utenti per nome o tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        </div>

        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 mb-4">
          {searchResults.length === 0 && searchTerm.length > 1 && !isSharing ? (
            <p className="text-gray-500 text-center py-4">Nessun utente trovato.</p>
          ) : (
            searchResults.map(user => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${selectedUsers.some(u => u.id === user.id) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                onClick={() => handleToggleUserSelection(user)}
              >
                <div className="flex items-center space-x-3">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-sm">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <span>{user.username} <span className="text-gray-500 text-sm">@{user.profileTag}</span></span>
                </div>
                {selectedUsers.some(u => u.id === user.id) && (
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                )}
              </div>
            ))
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="mb-4">
            <h3 className="text-md font-semibold text-gray-700 mb-2">Selezionati:</h3>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(user => (
                <span key={user.id} className="bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full flex items-center">
                  {user.username}
                  <button onClick={() => handleToggleUserSelection(user)} className="ml-2 text-gray-600 hover:text-gray-900">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleShare}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg"
          disabled={isSharing}
        >
          {isSharing ? 'Condivisione...' : 'Condividi'}
        </button>
      </div>
    </div>
  );
};

// Event Detail Modal Component
const EventDetailModal = ({ event, onClose, relatedEvents, initialIndex, activeTab, onRemoveTagFromEvent, onLikeToggle, onAddComment, onShareEvent }: { event: EventType; onClose: () => void; relatedEvents: EventType[]; initialIndex: number; activeTab: string; onRemoveTagFromEvent: (eventId: string) => Promise<void>; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; onAddComment: (eventId: string, commentText: string) => Promise<void>; onShareEvent: (event: EventType) => void; }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const { currentUser, userId, userProfile } = useAuth() || {};
  const [showAllComments, setShowAllComments] = useState(false); // Stato per mostrare tutti i commenti

  const currentEvent = relatedEvents[currentIndex];
  const isTaggedEvent = currentUser && currentEvent.taggedUsers && currentEvent.taggedUsers.includes(currentUser.email?.split('@')[0] || '');
  const isLiked = !!(currentUser && currentEvent.likes && currentEvent.likes.includes(currentUser.uid)); // Forza a boolean

  useEffect(() => {
    if (!currentEvent || !currentEvent.id) return;

    setLoadingComments(true);
    const commentsRef = collection(db, `artifacts/${appId}/public/data/events/${currentEvent.id}/comments`);
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as CommentData) }));
      setComments(fetchedComments);
      setLoadingComments(false);
    }, (error) => {
      console.error("Error fetching comments:", error);
      setLoadingComments(false);
    });

    return unsubscribeComments;
  }, [currentEvent, currentEvent.id]);

  const goToNext = () => {
    setCurrentIndex((prevIndex: number) => (prevIndex + 1) % relatedEvents.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex: number) => (prevIndex - 1 + relatedEvents.length) % relatedEvents.length);
  };

  const handleAddCommentSubmit = async () => { // Renamed to avoid confusion with prop
    if (!commentText.trim() || !currentUser || !userId || !userProfile) return;

    const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/events/${currentEvent.id}/comments`);
    try {
      await addDoc(commentsCollectionRef, {
        userId: userId,
        username: userProfile.username,
        text: commentText,
        createdAt: serverTimestamp(),
      } as CommentData);
      // Update comment count on the event document
      const eventRef = doc(db, `artifacts/${appId}/public/data/events`, currentEvent.id);
      await updateDoc(eventRef, {
        commentCount: (currentEvent.commentCount || 0) + 1
      });

      // Add notification for the event creator
      const eventDocSnap = await getDoc(eventRef);
      if (eventDocSnap.exists() && eventDocSnap.data().creatorId !== userId) {
        const eventCreatorId = eventDocSnap.data().creatorId;
        const notificationData: NotificationData = {
          type: 'comment',
          fromUserId: userId,
          fromUsername: userProfile.username,
          eventId: currentEvent.id,
          eventTag: eventDocSnap.data().tag,
          message: `${userProfile.username} ha commentato il tuo evento: ${eventDocSnap.data().tag}`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: eventDocSnap.data().coverImage || '',
        };
        await addDoc(collection(db, `artifacts/${appId}/users/${eventCreatorId}/notifications`), notificationData);
      }
      setCommentText(''); // Clear comment input after submission
    } catch (error) {
      console.error("Errore nell'aggiungere commento:", error);
    }
  };

  const defaultCoverImage = currentEvent.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(currentEvent.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  if (!currentEvent) return null;

  const displayedComments = showAllComments ? comments : comments.slice(0, 3);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col h-full md:h-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        {relatedEvents.length > 1 && (
          <>
            <button onClick={goToPrev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-75 rounded-full p-2 shadow-md hover:bg-opacity-100 transition-colors">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <button onClick={goToNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-75 rounded-full p-2 shadow-md hover:bg-opacity-100 transition-colors">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </>
        )}

        {currentEvent.coverImage ? (
          <img
            src={currentEvent.coverImage}
            alt={currentEvent.tag}
            className="w-full h-80 object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultCoverImage; }}
          />
        ) : (
          <img
            src={defaultCoverImage}
            alt={currentEvent.tag}
            className="w-full h-80 object-cover"
          />
        )}

        <div className="p-6 flex-grow overflow-y-auto">
          <h3 className="text-3xl font-bold text-gray-800 mb-3">#{currentEvent.tag}</h3>
          {currentEvent.description && <p className="text-gray-700 text-base mb-4">{currentEvent.description}</p>}
          <div className="text-gray-600 text-sm space-y-2 mb-4">
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {new Date(currentEvent.date).toLocaleDateString('it-IT')} alle {currentEvent.time}
            </p>
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              {currentEvent.locationName || 'Nessuna posizione specificata'}
            </p>
            {currentEvent.taggedUsers && currentEvent.taggedUsers.length > 0 && (
              <p className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                Taggati: {currentEvent.taggedUsers.join(', ')}
              </p>
            )}
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Stato: {currentEvent.isPublic ? 'Pubblico' : 'Privato'}
            </p>
          </div>

          <div className="flex items-center justify-around border-t border-b border-gray-200 py-3 mb-4">
            <button onClick={() => onLikeToggle(currentEvent.id, isLiked)} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
              <svg className={`w-6 h-6 ${isLiked ? 'text-red-500' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              <span className="text-sm">{currentEvent.likes ? currentEvent.likes.length : 0}</span>
            </button>
            <button className="flex items-center space-x-1 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <span className="text-sm">{comments.length}</span>
            </button>
            <button onClick={() => onShareEvent(currentEvent)} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
              <span className="text-sm">Condividi</span>
            </button>
          </div>

          {activeTab === 'taggedEvents' && isTaggedEvent && (
            <button
              onClick={() => { onRemoveTagFromEvent(currentEvent.id); onClose(); }}
              className="mt-4 px-4 py-2 rounded-lg font-bold bg-red-100 text-red-800 hover:bg-red-200 transition-colors duration-200"
            >
              Rimuovi Tag
            </button>
          )}

          {/* Comment Section */}
          <div className="mt-6">
            <h4 className="text-xl font-bold text-gray-800 mb-3">Commenti</h4>
            {loadingComments ? (
              <p className="text-center text-gray-600">Caricamento commenti...</p>
            ) : comments.length === 0 ? (
              <p className="text-gray-600 text-sm">Nessun commento. Sii il primo a commentare!</p>
            ) : (
              <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                {displayedComments.map(comment => (
                  <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">{comment.username}</p>
                    <p className="text-gray-700 text-sm">{comment.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleString('it-IT') : 'Data sconosciuta'}
                    </p>
                  </div>
                ))}
                {comments.length > 3 && !showAllComments && (
                  <button
                    onClick={() => setShowAllComments(true)}
                    className="text-sm text-gray-600 hover:text-gray-800 underline mt-2"
                  >
                    Mostra tutti i {comments.length} commenti
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Aggiungi un commento..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <button
                onClick={handleAddCommentSubmit} // Call the new handler
                className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente Notifiche
const NotificationsPage = () => {
  const { userId, userProfile } = useAuth() || {};
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/notifications`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as NotificationData) }));
      setNotifications(fetchedNotifications);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setMessage('Errore nel caricamento delle notifiche.');
      setMessageType('error');
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/notifications`, notificationId), {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        batch.update(doc(db, `artifacts/${appId}/users/${userId}/notifications`, n.id), { read: true });
      });
      await batch.commit();
      setMessage('Tutte le notifiche sono state contrassegnate come lette.');
      setMessageType('success');
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      setMessage('Errore nel contrassegnare tutte le notifiche come lette.');
      setMessageType('error');
    }
  };

  if (loading) {
    return (
      <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
        <p className="ml-4 text-xl text-gray-700">Caricamento notifiche...</p>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">Notifiche</h1>
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200 space-y-4">
        {message && (
          <div className={`p-3 rounded-lg text-center ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}
        {notifications.length > 0 && (
          <div className="text-right">
            <button
              onClick={markAllAsRead}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Segna tutte come lette
            </button>
          </div>
        )}
        {notifications.length === 0 ? (
          <p className="text-center text-gray-600">Nessuna notifica.</p>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border border-gray-200 flex items-start space-x-4 ${!notification.read ? 'bg-gray-50 font-semibold' : 'bg-white'}`}
            >
              {notification.imageUrl && (
                <img src={notification.imageUrl} alt="Event Cover" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-grow">
                <p className="text-gray-800">{notification.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {notification.createdAt?.toDate ? new Date(notification.createdAt.toDate()).toLocaleString('it-IT') : 'Data sconosciuta'}
                </p>
              </div>
              {!notification.read && (
                <button onClick={() => markAsRead(notification.id)} className="flex-shrink-0 text-gray-500 hover:text-gray-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};


// Componente Ricerca
const SearchPage = ({ onNavigate, onShowEventDetail }: { onNavigate: (page: string, id?: string | null) => void; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; }) => {
  const { currentUser, userId, userProfile } = useAuth() || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [foundEvents, setFoundEvents] = useState<EventType[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [suggestions, setSuggestions] = useState<Array<UserProfile | EventType>>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLUListElement>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        setLoadingSearch(true);
        try {
          // User search: username or profileTag
          const userQueryByUsername = query(
            collection(db, `artifacts/${appId}/users`),
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff')
          );
          // La ricerca per profileTag su collection(db, `artifacts/${appId}/users`)
          // non funzionerà correttamente perché profileTag è un campo annidato in 'profile/data'.
          // Per una ricerca corretta su profileTag in tutte le subcollection 'profile/data',
          // sarebbe necessaria una Collection Group Query (richiede indice).
          // Per semplicità, qui si cerca solo per username.

          const [usernameSnapshot] = await Promise.all([
            getDocs(userQueryByUsername),
          ]);

          const uniqueUsers = new Map<string, UserProfile>();
          usernameSnapshot.docs.forEach(doc => uniqueUsers.set(doc.id, { id: doc.id, ...(doc.data() as UserProfileData) }));

          let users = Array.from(uniqueUsers.values()).filter(user => currentUser && user.id !== currentUser.uid);
          if (userProfile && userProfile.following) {
            users.sort((a, b) => {
              const aFollowed = userProfile.following.includes(a.id);
              const bFollowed = userProfile.following.includes(b.id);
              if (aFollowed && !bFollowed) return -1;
              if (!aFollowed && bFollowed) return 1;
              return 0;
            });
          }

          // Event search: tag or locationName
          const eventQueryByTag = query(
            collection(db, `artifacts/${appId}/public/data/events`),
            where('isPublic', '==', true),
            where('tag', '>=', searchTerm),
            where('tag', '<=', searchTerm + '\uf8ff')
          );
          const eventsQueryByLocation = query(
            collection(db, `artifacts/${appId}/public/data/events`),
            where('isPublic', '==', true),
            where('locationName', '>=', searchTerm),
            where('locationName', '<=', searchTerm + '\uf8ff')
          );

          const [tagSnapshot, locationSnapshot] = await Promise.all([
            getDocs(eventQueryByTag),
            getDocs(eventsQueryByLocation)
          ]);

          const uniqueEvents = new Map<string, EventType>();
          tagSnapshot.docs.forEach(doc => uniqueEvents.set(doc.id, { id: doc.id, ...(doc.data() as EventData) }));
          locationSnapshot.docs.forEach(doc => uniqueEvents.set(doc.id, { id: doc.id, ...(doc.data() as EventData) }));
          const events = Array.from(uniqueEvents.values());

          setSuggestions([...users.slice(0, 3), ...events.slice(0, 3)]);

        } catch (error) {
          console.error("Error fetching suggestions:", error);
        } finally {
          setLoadingSearch(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, userId, userProfile]);

  const handleKeyDownOnSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev: number) => Math.min(prev + 1, suggestions.length - 1));
      if (suggestionListRef.current && selectedSuggestionIndex < suggestions.length - 1) {
        suggestionListRef.current.children[selectedSuggestionIndex + 1].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev: number) => Math.max(prev - 1, 0));
      if (suggestionListRef.current && selectedSuggestionIndex > 0) {
        suggestionListRef.current.children[selectedSuggestionIndex - 1].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter' && selectedSuggestionIndex !== -1) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
    }
  };

  const handleSelectSuggestion = (suggestion: UserProfile | EventType) => {
    setSearchTerm(suggestion.type === 'user' ? (suggestion as UserProfile).username : (suggestion as EventType).tag);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  const handleFullSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSearch(true);
    setSearchMessage('');
    setFoundUsers([]);
    setFoundEvents([]);
    setSuggestions([]);

    if (!searchTerm.trim()) {
      setSearchMessage('Inserisci un termine di ricerca.');
      setLoadingSearch(false);
      return;
    }

    try {
      // Search for users
      const usersQueryByUsername = query(
        collection(db, `artifacts/${appId}/users`),
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff')
      );
      // Come sopra, la ricerca per profileTag qui è omessa per le stesse ragioni.

      const [usernameSnapshot] = await Promise.all([
        getDocs(usersQueryByUsername),
      ]);

      const uniqueUsers = new Map<string, UserProfile>();
      usernameSnapshot.docs.forEach(doc => uniqueUsers.set(doc.id, { id: doc.id, ...(doc.data() as UserProfileData) }));
      setFoundUsers(Array.from(uniqueUsers.values()).filter(user => currentUser && user.id !== currentUser.uid));

      // Search for events
      const eventsQueryByTag = query(
        collection(db, `artifacts/${appId}/public/data/events`),
        where('isPublic', '==', true),
        where('tag', '>=', searchTerm),
        where('tag', '<=', searchTerm + '\uf8ff')
      );
      const eventsQueryByLocation = query(
        collection(db, `artifacts/${appId}/public/data/events`),
        where('isPublic', '==', true),
        where('locationName', '>=', searchTerm),
        where('locationName', '<=', searchTerm + '\uf8ff')
      );

      const [tagSnapshot, locationSnapshot] = await Promise.all([
        getDocs(eventsQueryByTag),
        getDocs(eventsQueryByLocation)
      ]);

      const uniqueEvents = new Map<string, EventType>();
      tagSnapshot.docs.forEach(doc => uniqueEvents.set(doc.id, { id: doc.id, ...(doc.data() as EventData) }));
      locationSnapshot.docs.forEach(doc => uniqueEvents.set(doc.id, { id: doc.id, ...(doc.data() as EventData) }));
      setFoundEvents(Array.from(uniqueEvents.values()));

      if (foundUsers.length === 0 && foundEvents.length === 0) {
        setSearchMessage('Nessun risultato trovato.');
      }
    } catch (error) {
      console.error("Errore nella ricerca:", error);
      setSearchMessage('Errore durante la ricerca. Riprova.');
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">Ricerca</h1>
      <form onSubmit={handleFullSearch} className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-xl border border-gray-200 space-y-4 mb-6">
        <div className="flex relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSelectedSuggestionIndex(-1); }}
            onKeyDown={handleKeyDownOnSearchInput}
            className="flex-grow px-4 py-2 bg-gray-50 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            placeholder="Cerca utenti o eventi..."
            ref={searchInputRef}
          />
          <button
            type="submit"
            className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-r-lg transition duration-300 ease-in-out shadow-lg"
          >
            Cerca
          </button>
          {suggestions.length > 0 && (
            <ul ref={suggestionListRef} className="absolute left-0 right-0 top-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg z-10">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id || (suggestion as any).place_id}
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${index === selectedSuggestionIndex ? 'bg-gray-100' : ''}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  {suggestion.type === 'user' ? (
                    <div className="flex items-center space-x-3">
                      {(suggestion as UserProfile).profileImage ? (
                        <img src={(suggestion as UserProfile).profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-sm">
                          {(suggestion as UserProfile).username[0].toUpperCase()}
                        </div>
                      )}
                      <span>{(suggestion as UserProfile).username} <span className="text-gray-500 text-sm">@{(suggestion as UserProfile).profileTag}</span></span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                       <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      <span>#{(suggestion as EventType).tag} {(suggestion as EventType).locationName && `(${(suggestion as EventType).locationName.split(',')[0]})`}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>

      {loadingSearch && (
        <div className="flex justify-center items-center mt-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-500"></div>
          <p className="ml-4 text-lg text-gray-700">Ricerca in corso...</p>
        </div>
      )}

      {!loadingSearch && searchMessage && (
        <p className="text-center text-gray-600 mt-8">{searchMessage}</p>
      )}

      {!loadingSearch && (foundUsers.length > 0 || foundEvents.length > 0) && (
        <div className="max-w-xl mx-auto p-4">
          {foundUsers.length > 0 && (
            <>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Utenti</h2>
              <div className="flex flex-col items-center gap-6 mb-8">
                {foundUsers.map(user => (
                  <div key={user.id} className="w-full bg-white p-5 rounded-2xl shadow-md border border-gray-200 flex items-center space-x-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer" onClick={() => onNavigate('userProfile', user.id)}>
                    {user.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt="Profile"
                        className="w-12 h-12 rounded-full object-cover border border-gray-400"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://placehold.co/48x48/CCC/333?text=${user.username ? user.username[0].toUpperCase() : 'U'}`; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xl">
                        {user.username ? user.username[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-800">{user.username}</p>
                      <p className="text-sm text-gray-600">@{user.profileTag}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {foundEvents.length > 0 && (
            <>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Eventi</h2>
              <div className="flex flex-col items-center gap-6">
                {foundEvents.map(event => (
                  <div key={event.id} className="w-full" onClick={() => onShowEventDetail(event, foundEvents, 'search')}>
                    <EventCard event={event} currentUser={currentUser || null} onFollowToggle={async () => {}} followingUsers={[]} onEdit={async () => {}} onDelete={async () => {}} onRemoveTag={async () => {}} onLikeToggle={async () => {}} onShowEventDetail={async () => {}} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Componente Modale di Conferma
const ConfirmationModal = ({ message, onConfirm, onCancel, show }: { message: string; onConfirm: () => void; onCancel: () => void; show: boolean }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <p className="text-lg font-semibold text-gray-800 mb-6">{message}</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg"
          >
            Conferma
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};


// Componente principale dell'App
const App = () => {
  const { currentUser, loading, userId, userProfile } = useAuth() || {};
  const [currentPage, setCurrentPage] = useState('home');
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [eventToEdit, setEventToEdit] = useState<EventType | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventType | null>(null);
  const [relatedEventsForModal, setRelatedEventsForModal] = useState<EventType[]>([]);
  const [initialEventIndexForModal, setInitialEventIndexForModal] = useState(0);
  const [modalActiveTab, setModalActiveTab] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [eventToShare, setEventToShare] = useState<EventType | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Stati per i modali di conferma
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{ id: string; isPublic: boolean } | null>(null);
  const [showRemoveTagConfirm, setShowRemoveTagConfirm] = useState(false);
  const [eventToRemoveTagFrom, setEventToRemoveTagFrom] = useState<string | null>(null);


  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/notifications`),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotificationsCount(snapshot.size);
    });

    return unsubscribe;
  }, [userId]);

  const handleNavigate = (page: string, id: string | null = null) => {
    setCurrentPage(page);
    setViewedUserId(id);
    setEventToEdit(null);
    setShowEventDetailModal(false);
    setShowShareModal(false); // Chiude il modale di condivisione alla navigazione
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleNavigate('home');
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  };

  const handleLoginSuccess = () => {
    handleNavigate('home');
  };

  const handleEventCreated = () => {
    handleNavigate('home');
  };

  // Funzione per mostrare il modale di conferma eliminazione
  const handleDeleteEvent = async (eventId: string, isPublic: boolean) => {
    setEventToDelete({ id: eventId, isPublic: isPublic });
    setShowDeleteConfirm(true);
  };

  // Funzione di conferma eliminazione (chiamata dal modale)
  const confirmDelete = async () => {
    if (eventToDelete && userId) {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, eventToDelete.id));
        if (eventToDelete.isPublic) {
          await deleteDoc(doc(db, `artifacts/${appId}/public/data/events`, eventToDelete.id));
        }
      } catch (error) {
        console.error("Errore durante l'eliminazione dell'evento:", error);
      } finally {
        setShowDeleteConfirm(false);
        setEventToDelete(null);
      }
    }
  };

  // Funzione di annullamento eliminazione (chiamata dal modale)
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEventToDelete(null);
  };

  // Funzione per mostrare il modale di conferma rimozione tag
  const handleRemoveTagFromEvent = async (eventId: string) => {
    setEventToRemoveTagFrom(eventId);
    setShowRemoveTagConfirm(true);
  };

  // Funzione di conferma rimozione tag (chiamata dal modale)
  const confirmRemoveTag = async () => {
    if (!currentUser || !userId || !eventToRemoveTagFrom) return;

    try {
      const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventToRemoveTagFrom);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const eventData = eventSnap.data() as EventData;
        const currentTaggedUsers = eventData.taggedUsers || [];
        const currentUserEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : `user_${userId.substring(0, 8)}`;

        if (currentTaggedUsers.includes(currentUserEmailPrefix)) {
          await updateDoc(eventRef, {
            taggedUsers: arrayRemove(currentUserEmailPrefix)
          });
        } else {
          console.warn("L'utente non è taggato in questo evento.");
        }
      }
    } catch (error) {
      console.error("Errore durante la rimozione del tag:", error);
    } finally {
      setShowRemoveTagConfirm(false);
      setEventToRemoveTagFrom(null);
    }
  };

  // Funzione di annullamento rimozione tag (chiamata dal modale)
  const cancelRemoveTag = () => {
    setShowRemoveTagConfirm(false);
    setEventToRemoveTagFrom(null);
  };


  const handleLikeToggle = async (eventId: string, isLiked: boolean) => {
    if (!currentUser || !userId || !userProfile) return;

    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    try {
      if (isLiked) {
        await updateDoc(eventRef, {
          likes: arrayRemove(userId)
        });
      } else {
        await updateDoc(eventRef, {
          likes: arrayUnion(userId)
        });
        // Add notification for the event creator
        const eventDocSnap = await getDoc(eventRef);
        if (eventDocSnap.exists() && eventDocSnap.data().creatorId !== userId) {
          const eventCreatorId = eventDocSnap.data().creatorId;
          const notificationData: NotificationData = {
            type: 'like',
            fromUserId: userId,
            fromUsername: userProfile.username,
            eventId: eventId,
            eventTag: eventDocSnap.data().tag,
            message: `${userProfile.username} ha messo "Mi piace" al tuo evento: ${eventDocSnap.data().tag}`,
            createdAt: serverTimestamp() as Timestamp,
            read: false,
            imageUrl: eventDocSnap.data().coverImage || '',
          };
          await addDoc(collection(db, `artifacts/${appId}/users/${eventCreatorId}/notifications`), notificationData);
        }
      }
    } catch (error) {
      console.error("Errore nel toggle like:", error);
    }
  };

  const handleAddComment = async (eventId: string, commentText: string) => {
    if (!commentText.trim() || !currentUser || !userId || !userProfile || !selectedEventForModal) return;

    const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/events/${eventId}/comments`);
    try {
      await addDoc(commentsCollectionRef, {
        userId: userId,
        username: userProfile.username,
        text: commentText,
        createdAt: serverTimestamp(),
      } as CommentData);
      // Update comment count on the event document
      const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
      await updateDoc(eventRef, {
        commentCount: (selectedEventForModal.commentCount || 0) + 1
      });

      // Add notification for the event creator
      const eventDocSnap = await getDoc(eventRef);
      if (eventDocSnap.exists() && eventDocSnap.data().creatorId !== userId) {
        const eventCreatorId = eventDocSnap.data().creatorId;
        const notificationData: NotificationData = {
          type: 'comment',
          fromUserId: userId,
          fromUsername: userProfile.username,
          eventId: eventId,
          eventTag: eventDocSnap.data().tag,
          message: `${userProfile.username} ha commentato il tuo evento: ${eventDocSnap.data().tag}`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: eventDocSnap.data().coverImage || '',
        };
        await addDoc(collection(db, `artifacts/${appId}/users/${eventCreatorId}/notifications`), notificationData);
      }
    } catch (error) {
      console.error("Errore nell'aggiungere commento:", error);
    }
  };

  const handleShareEvent = (event: EventType) => {
    setEventToShare(event);
    setShowShareModal(true);
  };

  const handleShowEventDetail = (event: EventType, relatedEvents: EventType[] = [], activeTab: string = '', isShareAction: boolean = false) => {
    setSelectedEventForModal(event);
    setRelatedEventsForModal(relatedEvents);
    setModalActiveTab(activeTab);
    const index = relatedEvents.findIndex(e => e.id === event.id);
    setInitialEventIndexForModal(index !== -1 ? index : 0);
    if (isShareAction) {
      handleShareEvent(event);
    } else {
      setShowEventDetailModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-gray-500"></div>
        <p className="ml-4 text-2xl">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="App font-sans antialiased text-gray-800 bg-gray-100">
      {!currentUser ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <Navbar onNavigate={handleNavigate} onLogout={handleLogout} unreadNotificationsCount={unreadNotificationsCount} />
          <main className="pb-16 md:pb-0">
            {currentPage === 'home' && <HomePage onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} />}
            {currentPage === 'createEvent' && <CreateEventPage onEventCreated={handleEventCreated} eventToEdit={eventToEdit} onCancelEdit={() => handleNavigate('myProfile')} />}
            {currentPage === 'myProfile' && <UserProfileDisplay userIdToDisplay={userId || ''} onNavigate={handleNavigate} onEditEvent={(event) => {
                setEventToEdit(event);
                handleNavigate('createEvent');
              }} onDeleteEvent={handleDeleteEvent} onRemoveTagFromEvent={handleRemoveTagFromEvent} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
            {currentPage === 'search' && <SearchPage onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} />}
            {currentPage === 'userProfile' && viewedUserId && <UserProfileDisplay userIdToDisplay={viewedUserId} onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} onEditEvent={async () => {}} onDeleteEvent={async () => {}} onRemoveTagFromEvent={async () => {}} />}
            {currentPage === 'notifications' && <NotificationsPage />}
          </main>
          {showEventDetailModal && selectedEventForModal && (
            <EventDetailModal
              event={selectedEventForModal}
              onClose={() => setShowEventDetailModal(false)}
              relatedEvents={relatedEventsForModal}
              initialIndex={initialEventIndexForModal}
              activeTab={modalActiveTab}
              onRemoveTagFromEvent={handleRemoveTagFromEvent}
              onLikeToggle={handleLikeToggle}
              onAddComment={handleAddComment}
              onShareEvent={handleShareEvent}
            />
          )}
          {showShareModal && eventToShare && (
            <ShareEventModal
              event={eventToShare}
              onClose={() => setShowShareModal(false)}
              onShareSuccess={() => {
                setShowShareModal(false);
                // Optionally show a success message on the main page or notification
              }}
            />
          )}

          <ConfirmationModal
            show={showDeleteConfirm}
            message="Sei sicuro di voler eliminare questo evento?"
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />

          <ConfirmationModal
            show={showRemoveTagConfirm}
            message="Sei sicuro di voler rimuovere il tuo tag da questo evento?"
            onConfirm={confirmRemoveTag}
            onCancel={cancelRemoveTag}
          />
        </>
      )}
    </div>
  );
};

// Wrapper per l'App con AuthProvider
const AppWrapper = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWrapper;
