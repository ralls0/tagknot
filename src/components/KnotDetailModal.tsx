import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import EventCard from './EventCard';
import { KnotType, EventType, KnotDetailModalProps, EventData } from '../interfaces'; // Aggiunto EventData

const appId = "tagknot-app";

const KnotDetailModal: React.FC<KnotDetailModalProps> = ({ knot, onClose, onShowEventDetail, onDeleteEvent, onLikeToggle, onRemoveTagFromEvent, onShareEvent, onAddSpotToKnot, onEditEvent }) => {
  const { currentUser, userId, userProfile } = useAuth();
  const [associatedSpots, setAssociatedSpots] = useState<EventType[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(true);

  const isOwnKnot = currentUser && knot.creatorId === currentUser.uid;

  // Funzione per recuperare i dettagli degli spot associati al knot
  useEffect(() => {
    let isMounted = true;
    if (!knot || knot.spotIds.length === 0) {
      if (isMounted) {
        setLoadingSpots(false);
        setAssociatedSpots([]); // Assicurati che sia vuoto se non ci sono spotIds
      }
      return;
    }

    setLoadingSpots(true);

    const fetchSpots = async () => {
      try {
        const fetchedSpots: EventType[] = [];
        // Recupera gli spot pubblici
        const publicSpotsQuery = query(
          collection(db, `artifacts/${appId}/public/data/events`),
          where('__name__', 'in', knot.spotIds)
        );
        const publicSpotsSnapshot = await getDocs(publicSpotsQuery);
        publicSpotsSnapshot.forEach(doc => {
          // Correggi la duplicazione dell'ID
          fetchedSpots.push({ id: doc.id, ...(doc.data() as EventData) } as EventType);
        });

        // Se il knot è dell'utente corrente, recupera anche i suoi spot privati
        // che potrebbero non essere pubblici ma sono inclusi nel knot
        if (isOwnKnot && userId) {
          const privateSpotsQuery = query(
            collection(db, `artifacts/${appId}/users/${userId}/events`),
            where('__name__', 'in', knot.spotIds)
          );
          const privateSpotsSnapshot = await getDocs(privateSpotsQuery);
          privateSpotsSnapshot.forEach(doc => {
            // Aggiungi solo se non già presente dalla collezione pubblica
            if (!fetchedSpots.some(spot => spot.id === doc.id)) {
              // Correggi la duplicazione dell'ID
              fetchedSpots.push({ id: doc.id, ...(doc.data() as EventData) } as EventType);
            }
          });
        }

        if (isMounted) {
          // Ordina gli spot per data e ora
          fetchedSpots.sort((a, b) => {
            const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
            const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
            return dateTimeA - dateTimeB;
          });
          setAssociatedSpots(fetchedSpots);
          setLoadingSpots(false);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching associated spots:", error);
          setLoadingSpots(false);
        }
      }
    };

    fetchSpots();

    return () => {
      isMounted = false;
    };
  }, [knot, knot.spotIds, isOwnKnot, userId]);

  const defaultCoverImage = knot.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(knot.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  if (!knot) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden relative flex flex-col h-full md:h-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
        </button>

        {knot.coverImage ? (
          <img
            src={knot.coverImage}
            alt={knot.tag}
            className="w-full h-64 object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultCoverImage; }}
          />
        ) : (
          <img
            src={defaultCoverImage}
            alt={knot.tag}
            className="w-full h-64 object-cover"
          />
        )}

        <div className="p-6 flex-grow overflow-y-auto">
          <h3 className="text-3xl font-bold text-gray-800 mb-3">{knot.tag} </h3>
          {knot.description && <p className="text-gray-700 text-base mb-4"> {knot.description} </p>}
          <div className="text-gray-600 text-sm space-y-2 mb-4">
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
              Dal {new Date(knot.startDate).toLocaleDateString('it-IT')} al {new Date(knot.endDate).toLocaleDateString('it-IT')}
            </p>
            {knot.locationName && (
              <p className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"> </path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg>
                {knot.locationName}
              </p>
            )}
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"> </path></svg>
              Stato: {knot.status === 'public' ? 'Pubblico' : knot.status === 'private' ? 'Privato' : 'Interno'}
            </p>
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              Spot inclusi: {knot.spotIds.length}
            </p>
          </div>

          <div className="mt-6">
            <h4 className="text-xl font-bold text-gray-800 mb-3">Spot in questo Knot</h4>
            {loadingSpots ? (
              <LoadingSpinner message="Caricamento spot..." />
            ) : associatedSpots.length === 0 ? (
              <p className="text-gray-600 text-sm text-center">Nessun spot associato a questo Knot.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {associatedSpots.map(spot => (
                  <EventCard
                    key={spot.id}
                    event={spot}
                    currentUser={currentUser}
                    // Passa funzioni asincrone vuote per conformità al tipo
                    onFollowToggle={async () => {}}
                    followingUsers={userProfile?.following || []}
                    onEdit={() => onEditEvent(spot)}
                    onDelete={() => onDeleteEvent(spot.id, spot.isPublic, spot.creatorId, spot.groupId)}
                    isProfileView={true}
                    onLikeToggle={(eventId, isLiked) => onLikeToggle(eventId, isLiked, spot.isPublic, spot.creatorId)}
                    onShowEventDetail={(e, r, t, s) => onShowEventDetail(e, r, t, s)}
                    onRemoveTag={(eId) => onRemoveTagFromEvent(eId)}
                    onAddSpotToKnot={onAddSpotToKnot}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnotDetailModal;
