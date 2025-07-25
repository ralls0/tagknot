import React, { useState, useEffect } from 'react';
import { EventType, KnotType } from '../interfaces';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const appId = "tagknot-app";

interface EventCardProps {
  event: EventType;
  currentUser: User | null;
  onFollowToggle: (creatorId: string, isFollowing: boolean) => Promise<void>;
  followingUsers: string[];
  onEdit: (event: EventType) => void;
  onDelete: (eventId: string, isPublic: boolean) => Promise<void>;
  isProfileView?: boolean;
  onLikeToggle: (eventId: string, isLiked: boolean, eventIsPublic: boolean, eventCreatorId: string) => Promise<void>; // Aggiornato
  onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void;
  onRemoveTag: (eventId: string) => Promise<void>;
  onAddSpotToKnot: (spot: EventType) => void;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  currentUser,
  onFollowToggle,
  followingUsers,
  onEdit,
  onDelete,
  isProfileView = false,
  onLikeToggle,
  onShowEventDetail,
  onRemoveTag,
  onAddSpotToKnot,
}) => {
  const isOwnEvent = currentUser && event.creatorId === currentUser.uid;
  const isFollowingCreator = followingUsers.includes(event.creatorId);
  const isLiked = currentUser && event.likes?.includes(currentUser.uid);
  const [showMenu, setShowMenu] = useState(false);
  const [knotNames, setKnotNames] = useState<string[]>([]);

  const defaultCoverImage = event.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(event.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  useEffect(() => {
    const fetchKnotNames = async () => {
      if (event.knotIds && event.knotIds.length > 0) {
        try {
          const publicKnotsQuery = query(
            collection(db, `artifacts/${appId}/public/data/knots`),
            where('__name__', 'in', event.knotIds)
          );
          const publicKnotsSnapshot = await getDocs(publicKnotsQuery);
          const fetchedPublicKnots = publicKnotsSnapshot.docs.map(doc => doc.data().tag as string);

          let fetchedPrivateKnots: string[] = [];
          if (isOwnEvent && currentUser?.uid) { // Aggiunto controllo currentUser?.uid
            const privateKnotsQuery = query(
              collection(db, `artifacts/${appId}/users/${currentUser.uid}/knots`),
              where('__name__', 'in', event.knotIds)
            );
            const privateKnotsSnapshot = await getDocs(privateKnotsQuery);
            fetchedPrivateKnots = privateKnotsSnapshot.docs.map(doc => doc.data().tag as string);
          }

          const combinedKnotNames = Array.from(new Set([...fetchedPublicKnots, ...fetchedPrivateKnots]));
          setKnotNames(combinedKnotNames);
        } catch (error) {
          console.error("Error fetching knot names for event:", error);
        }
      } else {
        setKnotNames([]);
      }
    };

    fetchKnotNames();
  }, [event.knotIds, isOwnEvent, currentUser?.uid]);


  const handleCardClick = () => {
    onShowEventDetail(event, [event], 'myEvents');
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(prev => !prev);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-xl relative">
      {isOwnEvent && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={toggleMenu}
            className="p-2 rounded-full bg-white bg-opacity-75 hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Opzioni spot"
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"></path>
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg py-1 z-20">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(event); setShowMenu(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Modifica
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAddSpotToKnot(event); setShowMenu(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Aggiungi a Knot
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(event.id, event.isPublic); setShowMenu(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100"
              >
                Elimina
              </button>
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar
            imageUrl={event.creatorProfileImage}
            username={event.creatorUsername}
            size="sm"
          />
          <span className="text-sm font-semibold text-gray-800"> {event.creatorUsername} </span>
        </div>
        {!isOwnEvent && currentUser && (
          <FollowButton
            isFollowing={isFollowingCreator}
            onToggle={() => onFollowToggle(event.creatorId, isFollowingCreator)}
          />
        )}
      </div>

      <div onClick={handleCardClick} className="cursor-pointer">
        {event.coverImage ? (
          <img
            src={event.coverImage}
            alt={event.tag}
            className="w-full h-48 object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultCoverImage; }}
          />
        ) : (
          <img
            src={defaultCoverImage}
            alt={event.tag}
            className="w-full h-48 object-cover"
          />
        )}

        <div className="p-4">
          <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{event.tag} </h3>
          {event.description && <p className="text-gray-700 text-sm mb-3 truncate"> {event.description} </p>}
          <div className="text-gray-600 text-xs space-y-1">
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
              {new Date(event.date).toLocaleDateString('it-IT')} alle {event.time}
            </p>
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"> </path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg>
              <span className="truncate">{event.locationName || 'Nessuna posizione specificata'}</span>
            </p>
            {knotNames.length > 0 && (
              <p className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                Parte di: {knotNames.map(name => `#${name}`).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 flex items-center justify-around">
        <button onClick={() => onLikeToggle(event.id, isLiked || false, event.isPublic, event.creatorId)} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
          <svg className={`w-5 h-5 ${isLiked ? 'text-red-500' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"> </path></svg>
          <span className="text-sm"> {event.likes ? event.likes.length : 0} </span>
        </button>
        <button onClick={handleCardClick} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" clipRule="evenodd"></path></svg>
          <span className="text-sm"> {event.commentCount || 0} </span>
        </button>
      </div>
    </div>
  );
};

export default EventCard;
