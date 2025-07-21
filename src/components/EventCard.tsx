import React from 'react';
import { EventType, UserProfile } from '../interfaces';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import { User } from 'firebase/auth'; // Importa il tipo User da firebase/auth

interface EventCardProps {
  event: EventType;
  currentUser: User | null; // Usa il tipo User di Firebase
  onFollowToggle: (creatorId: string, isFollowing: boolean) => Promise<void>;
  followingUsers: string[];
  onEdit: (event: EventType) => void;
  onDelete: (eventId: string, isPublic: boolean) => Promise<void>;
  isProfileView?: boolean;
  onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>;
  onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void;
  onRemoveTag: (eventId: string) => Promise<void>;
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
}) => {
  const isOwnEvent = currentUser && event.creatorId === currentUser.uid;
  const isFollowingCreator = followingUsers.includes(event.creatorId);
  const isLiked = currentUser && event.likes?.includes(currentUser.uid);

  const defaultCoverImage = event.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(event.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  const handleCardClick = () => {
    // Passa l'evento corrente e, se disponibile, una lista di eventi correlati
    // Per la vista profilo, `relatedEvents` potrebbe essere l'array di tutti gli eventi dell'utente
    // Per altre viste (es. HomePage, SearchPage), `relatedEvents` dovrebbe essere l'array di eventi visualizzati in quella pagina
    // Qui, per semplicità, passiamo solo l'evento singolo, ma puoi estenderlo se la card fa parte di una lista navigabile.
    onShowEventDetail(event, [event], 'myEvents'); // Passa l'evento stesso in un array per la navigazione singola
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-xl">
      {/* Contenitore principale cliccabile per aprire i dettagli */}
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
          <h3 className="text-xl font-bold text-gray-800 mb-2">#{event.tag} </h3>
          {event.description && <p className="text-gray-700 text-sm mb-3 truncate"> {event.description} </p>}
          <div className="text-gray-600 text-xs space-y-1">
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
              {new Date(event.date).toLocaleDateString('it-IT')} alle {event.time}
            </p>
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"> </path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg>
              {event.locationName || 'Nessuna posizione specificata'}
            </p>
          </div>
        </div>
      </div> {/* Fine del div cliccabile */}

      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar
            imageUrl={event.creatorProfileImage} // Usato il campo dal tipo EventType
            username={event.creatorUsername} // Usato il campo dal tipo EventType
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

      <div className="p-4 border-t border-gray-200 flex items-center justify-around">
        <button onClick={() => onLikeToggle(event.id, isLiked || false)} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
          <svg className={`w-5 h-5 ${isLiked ? 'text-red-500' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"> </path></svg>
          <span className="text-sm"> {event.likes ? event.likes.length : 0} </span>
        </button>
        <button onClick={handleCardClick} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"> </path></svg>
          <span className="text-sm"> {event.commentCount || 0} </span>
        </button>
        {isOwnEvent && (
          <>
            <button onClick={() => onEdit(event)} className="flex items-center space-x-1 text-gray-600 hover:text-blue-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"> </path></svg>
              <span className="text-sm">Modifica</span>
            </button>
            <button onClick={() => onDelete(event.id, event.isPublic)} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"> </path></svg>
              <span className="text-sm">Elimina</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EventCard;
