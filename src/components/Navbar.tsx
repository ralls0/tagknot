import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import UserAvatar from './UserAvatar';

const Navbar = ({ onNavigate, onLogout, unreadNotificationsCount }: { onNavigate: (page: string, id?: string | null) => void; onLogout: () => void; unreadNotificationsCount: number }) => {
  const authContext = useAuth();
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

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
          <UserAvatar
            imageUrl={userProfile?.profileImage}
            username={userProfile?.username}
            size="sm"
          />
          <span className="font-semibold text-gray-800 hidden sm:block">{userProfile?.username || 'Caricamento...'}</span>
        </div>

        {/* Navigation Buttons (centered, hidden on mobile) */}
        <div className="hidden md:flex justify-center space-x-6">
          {/* HomePage commentata come richiesto */}
          {/*
          <button onClick={() => handleMenuItemClick('home')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"> </path></svg>
            <span className="text-xs mt-1 hidden md:block">Home</span>
          </button>
          */}
          <button onClick={() => handleMenuItemClick('createEvent')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"> </path></svg>
            <span className="text-xs mt-1 hidden md:block">Crea Spot</span>
          </button>
          {/* SearchPage commentata come richiesto */}
          {/*
          <button onClick={() => handleMenuItemClick('search')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"> </path></svg>
            <span className="text-xs mt-1 hidden md:block">Cerca</span>
          </button>
          */}
          <button onClick={() => handleMenuItemClick('myProfile')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"> </path></svg>
            <span className="text-xs mt-1 hidden md:block">Profilo</span>
          </button>
          <button onClick={() => handleMenuItemClick('notifications')} className="relative flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.002 2.002 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"> </path></svg>
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2z"> </path></svg>
          </button>
          {
            showSettingsMenu && (
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
            )
          }
        </div>
      </nav>

      {/* Bottom Navbar for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-sm z-50 py-2 flex justify-around md:hidden">
        {/* HomePage commentata come richiesto */}
        {/*
        <button onClick={() => handleMenuItemClick('home')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"> </path></svg>
          <span className="text-xs mt-1">Home</span>
        </button>
        */}
        <button onClick={() => handleMenuItemClick('createEvent')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"> </path></svg>
          <span className="text-xs mt-1">Crea Spot</span>
        </button>
        {/* SearchPage commentata come richiesto */}
        {/*
        <button onClick={() => handleMenuItemClick('search')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"> </path></svg>
          <span className="text-xs mt-1">Cerca</span>
        </button>
        */}
        <button onClick={() => handleMenuItemClick('myProfile')} className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"> </path></svg>
          <span className="text-xs mt-1">Profilo</span>
        </button>
        <button onClick={() => handleMenuItemClick('notifications')} className="relative flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.002 2.002 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"> </path></svg>
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

export default Navbar;
