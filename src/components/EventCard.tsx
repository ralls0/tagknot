import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import { EventType, UserProfileData } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const EventCard = ({ event, currentUser, onFollowToggle, followingUsers, onEdit, onDelete, onRemoveTag, isProfileView = false, onLikeToggle, onShowEventDetail }: { event: EventType; currentUser: any; onFollowToggle: (creatorId: string, isFollowing: boolean) => Promise<void>; followingUsers: string[]; onEdit: (event: EventType) => void; onDelete: (eventId: string, isPublic: boolean) => Promise<void>; onRemoveTag: (eventId: string) => Promise<void>; isProfileView?: boolean; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; }) => {
  const [creatorUsername, setCreatorUsername] = useState('Caricamento...');
  const [creatorProfileImage, setCreatorProfileImage] = useState('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const isFollowing = followingUsers.includes(event.creatorId);
  const isOwnEvent = currentUser && currentUser.uid === event.creatorId;
  const authContext = useAuth();
  const currentUserProfileTag = authContext?.userProfile?.profileTag || (currentUser?.email ? currentUser.email.split('@')[0] : '');
  const isTaggedEvent = currentUser && (event.taggedUsers || []).includes(currentUserProfileTag);
  const isLiked = !!(currentUser && event.likes && event.likes.includes(currentUser.uid));

  useEffect(() => {
    let isMounted = true;

    const fetchCreatorData = async () => {
      if (event.creatorId) {
        try {
          const userProfileRef = doc(db, `artifacts/${appId}/users/${event.creatorId}/profile/data`);
          const userDocSnap = await getDoc(userProfileRef);
          if (isMounted) {
            if (userDocSnap.exists()) {
              const data = userDocSnap.data() as UserProfileData;
              setCreatorUsername(data.username || 'Utente Sconosciuto');
              setCreatorProfileImage(data.profileImage || '');
            } else {
              setCreatorUsername('Utente Sconosciuto');
              setCreatorProfileImage('');
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error fetching creator data for event card:", error);
            setCreatorUsername('Errore');
            setCreatorProfileImage('');
          }
        }
      }
    };
    fetchCreatorData();

    return () => {
      isMounted = false;
    };
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
          <UserAvatar
            imageUrl={creatorProfileImage}
            username={creatorUsername}
            size="md"
          />
          <span className="font-semibold text-gray-800">{creatorUsername}</span>
        </div>
        {
          isProfileView && isOwnEvent && (
            <div className="relative" ref={optionsMenuRef}>
              <button onClick={() => setShowOptionsMenu(prev => !prev)} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2zm0 7a1 1 0 100-2 1 1 0 000 2z"> </path></svg>
              </button>
              {
                showOptionsMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg py-1 border border-gray-200 z-10">
                    <button onClick={() => { onEdit(event); setShowOptionsMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Modifica
                    </button>
                    <button onClick={() => { onDelete(event.id, event.isPublic); setShowOptionsMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      Elimina
                    </button>
                  </div>
                )
              }
            </div>
          )}
        {
          isProfileView && !isOwnEvent && isTaggedEvent && (
            <button onClick={() => onRemoveTag(event.id)} className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition-colors duration-200">
              Rimuovi Tag
            </button>
          )
        }
      </div>

      {
        event.coverImage ? (
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
          <h3 className="text-2xl font-bold text-gray-800 mb-2">#{event.tag} </h3>
          {!isOwnEvent && (
            <FollowButton
              isFollowing={isFollowing}
              onToggle={() => onFollowToggle(event.creatorId, isFollowing)}
            />
          )}
        </div>
        {event.description && <p className="text-gray-700 text-sm mb-3"> {event.description} </p>}
        <div className="text-gray-600 text-sm space-y-1">
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
            {new Date(event.date).toLocaleDateString('it-IT')} alle {event.time}
          </p>
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"> </path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg>
            {event.locationName}
          </p>
          {
            (event.taggedUsers && event.taggedUsers.length > 0) && (
              <p className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"> </path></svg>
                Taggati: {(event.taggedUsers || []).join(', ')}
              </p>
            )
          }
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {event.isPublic ? 'Pubblico' : 'Privato'}
        </p>
        <div className="flex items-center justify-around mt-4 border-t border-gray-200 pt-4">
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onLikeToggle(event.id, isLiked); }} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
            <svg className={`w-6 h-6 ${isLiked ? 'text-red-500' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"> </path></svg>
            <span className="text-sm"> {event.likes ? event.likes.length : 0} </span>
          </button>
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onShowEventDetail(event); }} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"> </path></svg>
            <span className="text-sm"> {event.commentCount ? event.commentCount : 0} </span>
          </button>
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onShowEventDetail(event, undefined, undefined, true); }} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"> </path></svg>
            <span className="text-sm">Condividi</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
