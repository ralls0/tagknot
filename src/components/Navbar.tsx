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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-md z-40 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
        {/* Logo per schermi grandi */}
        <div className="hidden md:flex items-center space-x-3">
          <img src="/logo192.png" alt="Tagknot Logo" className="h-10 w-10 rounded-full" />
          <span className="text-2xl font-bold text-gray-800">Tagknot</span>
        </div>

        {/* Logo per schermi piccoli (centrato) */}
        <div className="flex-grow flex justify-center md:hidden">
          <img src="/logo192.png" alt="Tagknot Logo" className="h-10 w-10 rounded-full" />
          <span className="text-2xl font-bold text-gray-800 ml-2">Tagknot</span>
        </div>

        {/* Menu di navigazione principale (visibile su schermi grandi) */}
        <div className="hidden md:flex items-center space-x-6">
          <button
            onClick={() => onNavigate('myProfile')}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
          >
            Mio Profilo
          </button>
          <button
            onClick={() => onNavigate('createEvent')}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
          >
            Crea Spot
          </button>
          <button
            onClick={() => onNavigate('notifications')}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 relative"
          >
            Notifiche
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
          >
            Impostazioni
          </button>
          <button
            onClick={onLogout}
            className="bg-gray-800 text-white px-4 py-2 rounded-md text-base font-medium hover:bg-gray-900 transition-colors duration-200"
          >
            Logout
          </button>
          {userProfile && (
            <UserAvatar
              imageUrl={userProfile.profileImage}
              username={userProfile.username}
              size="md"
              onClick={() => onNavigate('myProfile')}
              className="cursor-pointer"
            />
          )}
        </div>

        {/* Hamburger menu per schermi piccoli */}
        <div className="flex items-center md:hidden">
          {/* Notifiche su schermi piccoli (prima dei tre puntini) */}
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

          <button
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Apri menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Menu a tendina per schermi piccoli */}
      {isMenuOpen && (
        <div className="md:hidden mt-2 space-y-2 pb-3 border-t border-gray-200 pt-3">
          <button
            onClick={() => { onNavigate('myProfile'); toggleMenu(); }}
            className="block w-full text-left text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md text-base font-medium transition-colors duration-200"
          >
            Mio Profilo
          </button>
          <button
            onClick={() => { onNavigate('createEvent'); toggleMenu(); }}
            className="block w-full text-left text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md text-base font-medium transition-colors duration-200"
          >
            Crea Spot
          </button>
          {/* Le notifiche sono già sopra, non ripeterle qui */}
          <button
            onClick={() => { onNavigate('settings'); toggleMenu(); }}
            className="block w-full text-left text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md text-base font-medium transition-colors duration-200"
          >
            Impostazioni
          </button>
          <button
            onClick={() => { onLogout(); toggleMenu(); }}
            className="block w-full text-left bg-gray-800 text-white px-4 py-2 rounded-md text-base font-medium hover:bg-gray-900 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
