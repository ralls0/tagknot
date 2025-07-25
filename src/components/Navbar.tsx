import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import UserAvatar from './UserAvatar';

interface NavbarProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
  unreadNotificationsCount: number;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, onLogout, unreadNotificationsCount }) => {
  const { userProfile } = useAuth();
  // isMenuOpen non è più necessario per il menu a tendina mobile principale
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false); // Stato per il menu a tre puntini desktop
  const [isMobileDotsMenuOpen, setIsMobileDotsMenuOpen] = useState(false); // Stato per il menu a tre puntini mobile

  // Non più necessario un toggleMenu generico, useremo toggleMobileDotsMenu
  const toggleDesktopMenu = () => {
    setIsDesktopMenuOpen(!isDesktopMenuOpen);
  };

  const toggleMobileDotsMenu = () => {
    setIsMobileDotsMenuOpen(!isMobileDotsMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-md z-40 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
        {/* Sezione sinistra: Miniatura profilo utente e nome (Desktop e Mobile) */}
        <div className="flex items-center space-x-3">
          {userProfile && (
            <UserAvatar
              imageUrl={userProfile.profileImage}
              username={userProfile.username}
              size="md"
              onClick={() => onNavigate('myProfile')}
              className="cursor-pointer"
            />
          )}
          {/* Mostra il nome utente solo su desktop */}
          <span className="hidden md:block text-lg font-semibold text-gray-800">
            {userProfile?.username || 'Guest'}
          </span>
        </div>

        {/* Sezione centrale: Logo dell'app e nome (Desktop e Mobile) */}
        <div className="flex-grow flex justify-center items-center">
          <img src="/logo192.png" alt="Tagknot Logo" className="h-10 w-10 rounded-full md:h-12 md:w-12" />
          <span className="text-2xl font-bold text-gray-800 ml-2 md:text-3xl">Tagknot</span>
        </div>

        {/* Sezione destra: Menu di navigazione principale (visibile su schermi grandi) */}
        <div className="hidden md:flex items-center space-x-6">
          <button
            onClick={() => onNavigate('createEvent')}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors duration-200"
            aria-label="Crea Spot"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          </button>
          <button
            onClick={() => onNavigate('groups')}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors duration-200"
            aria-label="Gruppi"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12c1.657 0 3-1.343 3-3S13.657 6 12 6s-3 1.343-3 3 1.343 3 3 3z" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18v-1a4 4 0 014-4h4a4 4 0 014 4v1" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.5 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2 18v-1.5a3.5 3.5 0 013.5-3.5h.5" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 18v-1.5a3.5 3.5 0 00-3.5-3.5h-.5" /></svg>
          </button>
          <button
            onClick={() => onNavigate('notifications')}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-md relative transition-colors duration-200"
            aria-label="Notifiche"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          {/* Menu a tre puntini per Desktop */}
          <div className="relative">
            <button
              onClick={toggleDesktopMenu}
              className="text-gray-600 hover:text-gray-900 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Opzioni menu"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"></path></svg>
            </button>
            {isDesktopMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg py-1 z-20">
                <button
                  onClick={() => { onNavigate('settings'); toggleDesktopMenu(); }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Impostazioni
                </button>
                <button
                  onClick={() => { onLogout(); toggleDesktopMenu(); }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sezione destra: Notifiche e Hamburger menu (visibile su schermi piccoli) */}
        <div className="flex items-center md:hidden">
          {/* Notifiche su schermi piccoli */}
          <button
            onClick={() => onNavigate('notifications')}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-md relative mr-2"
            aria-label="Notifiche"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Hamburger menu (tre puntini) per schermi piccoli */}
          <div className="relative">
            <button
              onClick={toggleMobileDotsMenu}
              className="text-gray-600 hover:text-gray-900 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Apri menu"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"></path></svg>
            </button>
            {isMobileDotsMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg py-1 z-20">
                <button
                  onClick={() => { onNavigate('settings'); toggleMobileDotsMenu(); }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Impostazioni
                </button>
                <button
                  onClick={() => { onLogout(); toggleMobileDotsMenu(); }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra di navigazione inferiore per schermi piccoli (mobile/tablet) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg md:hidden flex justify-around items-center h-16 border-t border-gray-200">
        <button
          onClick={() => onNavigate('groups')}
          className="flex flex-col items-center text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors duration-200"
          aria-label="Gruppi"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12c1.657 0 3-1.343 3-3S13.657 6 12 6s-3 1.343-3 3 1.343 3 3 3z" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18v-1a4 4 0 014-4h4a4 4 0 014 4v1" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.5 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2 18v-1.5a3.5 3.5 0 013.5-3.5h.5" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 18v-1.5a3.5 3.5 0 00-3.5-3.5h-.5" /></svg>
          <span className="text-xs mt-1">Gruppi</span>
        </button>
        <button
          onClick={() => onNavigate('createEvent')}
          className="flex flex-col items-center text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors duration-200"
          aria-label="Crea Spot"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          <span className="text-xs mt-1">Crea Spot</span>
        </button>
        <button
          onClick={() => onNavigate('myProfile')}
          className="flex flex-col items-center text-gray-600 hover:text-gray-900 p-2 rounded-md transition-colors duration-200"
          aria-label="Mio Profilo"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span className="text-xs mt-1">Profilo</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
