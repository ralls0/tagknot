import React, { useState, useEffect, useRef } from 'react';
import { collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import UserAvatar from './UserAvatar';
import EventCard from './EventCard';
import { EventType, UserProfile, UserProfileData, EventData } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const SearchPage = ({ onNavigate, onShowEventDetail }: { onNavigate: (page: string, id?: string | null) => void; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; }) => {
  const authContext = useAuth();
  const currentUser = authContext?.currentUser;
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

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
    let isMounted = true;
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        setLoadingSearch(true);
        try {
          const userQueryByUsername = query(
            collectionGroup(db, 'profile'),
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff')
          );

          const [usernameSnapshot] = await Promise.all([
            getDocs(userQueryByUsername),
          ]);

          if (!isMounted) return;

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

          if (!isMounted) return;

          const uniqueEvents = new Map<string, EventType>();
          tagSnapshot.docs.forEach(doc => uniqueEvents.set(doc.id, { id: doc.id, ...(doc.data() as EventData) }));
          locationSnapshot.docs.forEach(doc => uniqueEvents.set(doc.id, { id: doc.id, ...(doc.data() as EventData) }));
          const events = Array.from(uniqueEvents.values());

          setSuggestions([...users.slice(0, 3), ...events.slice(0, 3)]);

        } catch (error) {
          if (isMounted) {
            console.error("Error fetching suggestions:", error);
            setSearchMessage('Errore durante la ricerca dei suggerimenti.');
          }
        } finally {
          if (isMounted) {
            setLoadingSearch(false);
          }
        }
      } else {
        if (isMounted) {
          setSuggestions([]);
        }
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchTerm, userId, userProfile]);

  const handleKeyDownOnSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev: number) => Math.min(prev + 1, suggestions.length - 1));
      if (suggestionListRef.current && selectedSuggestionIndex < suggestions.length - 1) {
        (suggestionListRef.current.children[selectedSuggestionIndex + 1] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev: number) => Math.max(prev - 1, 0));
      if (suggestionListRef.current && selectedSuggestionIndex > 0) {
        (suggestionListRef.current.children[selectedSuggestionIndex - 1] as HTMLElement).scrollIntoView({ block: 'nearest' });
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
      const usersQueryByUsername = query(
        collectionGroup(db, 'profile'),
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff')
      );

      const [usernameSnapshot] = await Promise.all([
        getDocs(usersQueryByUsername),
      ]);

      const uniqueUsers = new Map<string, UserProfile>();
      usernameSnapshot.docs.forEach(doc => uniqueUsers.set(doc.id, { id: doc.id, ...(doc.data() as UserProfileData) }));
      setFoundUsers(Array.from(uniqueUsers.values()).filter(user => currentUser && user.id !== currentUser.uid));

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
      setFoundEvents(Array.from(uniqueEvents.values()));

      if (uniqueUsers.size === 0 && uniqueEvents.size === 0) {
        setSearchMessage('Nessun risultato trovato.');
      }
    } catch (error) {
      console.error("Error during full search:", error);
      setSearchMessage('Errore durante la ricerca. Riprova.');
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800"> Ricerca </h1>
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
          {
            suggestions.length > 0 && (
              <ul ref={suggestionListRef} className="absolute left-0 right-0 top-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg z-10">
                {
                  suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.id || (suggestion as any).place_id}
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${index === selectedSuggestionIndex ? 'bg-gray-100' : ''}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      {
                        suggestion.type === 'user' ? (
                          <div className="flex items-center space-x-3">
                            <UserAvatar
                              imageUrl={(suggestion as UserProfile).profileImage}
                              username={(suggestion as UserProfile).username}
                              size="sm"
                            />
                            <span>{(suggestion as UserProfile).username} <span className="text-gray-500 text-sm"> @{(suggestion as UserProfile).profileTag}</span></span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
                            <span>{ (suggestion as EventType).tag } { (suggestion as EventType).locationName && `(${(suggestion as EventType).locationName.split(',')[0]})` } </span>
                          </div>
                        )}
                    </li>
                  ))}
              </ul>
            )
          }
        </div>
      </form>

      {
        loadingSearch && (
          <LoadingSpinner message="Ricerca in corso..." />
        )
      }

      {
        !loadingSearch && searchMessage && (
          <p className="text-center text-gray-600 mt-8"> {searchMessage} </p>
        )
      }

      {
        !loadingSearch && (foundUsers.length > 0 || foundEvents.length > 0) && (
          <div className="max-w-xl mx-auto p-4">
            {
              foundUsers.length > 0 && (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4"> Utenti </h2>
                  <div className="flex flex-col items-center gap-6 mb-8">
                    {
                      foundUsers.map(user => (
                        <div key={user.id} className="w-full bg-white p-5 rounded-2xl shadow-md border border-gray-200 flex items-center space-x-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer" onClick={() => onNavigate('userProfile', user.id)}>
                          <UserAvatar
                            imageUrl={user.profileImage}
                            username={user.username}
                            size="lg"
                          />
                          <div>
                            <p className="font-semibold text-gray-800"> {user.username} </p>
                            <p className="text-sm text-gray-600"> @{user.profileTag} </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

            {
              foundEvents.length > 0 && (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4"> Eventi </h2>
                  <div className="flex flex-col items-center gap-6">
                    {
                      foundEvents.map(event => (
                        <div key={event.id} className="w-full" onClick={() => onShowEventDetail(event, foundEvents, 'search')}>
                          <EventCard event={event} currentUser={currentUser} onFollowToggle={async () => { }} followingUsers={[]} onEdit={async () => { }} onDelete={async () => { }} onRemoveTag={async () => { }} onLikeToggle={async () => { }} onShowEventDetail={async () => { }} />
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

export default SearchPage;
