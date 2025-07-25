import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, writeBatch, increment, Timestamp } from 'firebase/firestore'; // Aggiunto Timestamp
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { EventType, CommentType, NotificationData, EventDetailModalProps, CommentData, EventData } from '../interfaces'; // Aggiunto CommentData, EventData

const appId = "tagknot-app";

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose, relatedEvents, initialIndex, activeTab, onRemoveTagFromEvent, onLikeToggle, onShareEvent, onAddSpotToKnot, onUpdateEvent }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const authContext = useAuth();
  const currentUser = authContext?.currentUser;
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;
  const [showAllComments, setShowAllComments] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<EventType>(relatedEvents[initialIndex] || event); // Stato locale per l'evento corrente

  // Aggiorna l'evento locale quando le props cambiano (es. navigazione tra eventi correlati)
  useEffect(() => {
    setCurrentEvent(relatedEvents[currentIndex] || event);
  }, [currentIndex, relatedEvents, event]);

  const currentUserProfileTag = userProfile?.profileTag || (currentUser?.email ? currentUser.email.split('@')[0] : '');
  const isTaggedEvent = currentUser && (currentEvent?.taggedUsers || []).includes(currentUserProfileTag);
  const isLiked = !!(currentUser && currentEvent?.likes && currentEvent.likes.includes(currentUser.uid));
  const isOwnEvent = currentUser && currentEvent.creatorId === currentUser.uid;

  useEffect(() => {
    let isMounted = true;

    if (!currentEvent || !currentEvent.id) {
      if (isMounted) setLoadingComments(false);
      return;
    }

    setLoadingComments(true);
    const commentsRef = collection(db, `artifacts/${appId}/public/data/events/${currentEvent.id}/comments`);
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      if (isMounted) {
        // Correggi la tipizzazione qui: doc.data() restituisce CommentData, non CommentType
        const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as CommentData) } as CommentType));
        setComments(fetchedComments);
        setLoadingComments(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching comments:", error);
        setLoadingComments(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeComments();
    };
  }, [currentEvent, currentEvent?.id]);

  const goToNext = () => {
    setCurrentIndex((prevIndex: number) => (prevIndex + 1) % relatedEvents.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex: number) => (prevIndex - 1 + relatedEvents.length) % relatedEvents.length);
  };

  const handleAddCommentSubmit = async () => {
    if (!commentText.trim() || !currentUser || !userId || !userProfile || !currentEvent) {
      console.warn("Impossibile aggiungere commento: testo, utente o informazioni sull'evento mancanti.");
      return;
    }

    const publicCommentsCollectionRef = collection(db, `artifacts/${appId}/public/data/events/${currentEvent.id}/comments`);
    const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, currentEvent.id);
    const privateEventRef = doc(db, `artifacts/${appId}/users/${currentEvent.creatorId}/events`, currentEvent.id);

    try {
      const batch = writeBatch(db);

      await addDoc(publicCommentsCollectionRef, {
        userId: userId,
        username: userProfile.username,
        text: commentText,
        createdAt: serverTimestamp(),
      } as CommentData);

      // Aggiorna il contatore dei commenti solo se l'evento è pubblico o se è un evento privato dell'utente corrente
      if (currentEvent.isPublic) {
        batch.update(publicEventRef, {
          commentCount: increment(1)
        });
      }

      // Aggiorna il contatore dei commenti per la copia privata dell'evento, se esiste
      const privateEventDocSnap = await getDoc(privateEventRef);
      if (privateEventDocSnap.exists()) {
        batch.update(privateEventRef, {
          commentCount: increment(1)
        });
      }


      await batch.commit();

      // Dopo l'aggiornamento di Firestore, recupera l'evento aggiornato
      const updatedEventSnap = await getDoc(currentEvent.isPublic ? publicEventRef : privateEventRef);
      if (updatedEventSnap.exists()) {
        // Correggi la tipizzazione qui: doc.data() restituisce EventData, non EventType
        const updatedEventData = { id: updatedEventSnap.id, ...(updatedEventSnap.data() as EventData) } as EventType;
        setCurrentEvent(updatedEventData); // Aggiorna lo stato locale
        onUpdateEvent(updatedEventData); // Notifica il componente padre
      }

      if (currentEvent.creatorId !== userId) {
        const notificationData: NotificationData = {
          type: 'comment',
          fromUserId: userId,
          fromUsername: userProfile.username,
          eventId: currentEvent.id,
          eventTag: currentEvent.tag,
          message: `${userProfile.username} ha commentato il tuo evento: ${currentEvent.tag}`,
          createdAt: serverTimestamp() as Timestamp, // Timestamp è ora importato
          read: false,
          imageUrl: currentEvent.coverImage || '',
        };
        await addDoc(collection(db, `artifacts/${appId}/users/${currentEvent.creatorId}/notifications`), notificationData);
      }
      setCommentText('');
    } catch (error) {
      console.error("Errore durante l'aggiunta del commento:", error);
    }
  };

  const defaultCoverImage = currentEvent?.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(currentEvent.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  if (!currentEvent) return null;

  const displayedComments = showAllComments ? comments : comments.slice(0, 3);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col h-full md:h-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
        </button>

        {
          relatedEvents.length > 1 && (
            <>
              <button onClick={goToPrev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-75 rounded-full p-2 shadow-md hover:bg-opacity-100 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"> </path></svg>
              </button>
              <button onClick={goToNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-75 rounded-full p-2 shadow-md hover:bg-opacity-100 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"> </path></svg>
              </button>
            </>
          )}

        {
          currentEvent.coverImage ? (
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
          <h3 className="text-3xl font-bold text-gray-800 mb-3">{currentEvent.tag} </h3>
          {currentEvent.description && <p className="text-gray-700 text-base mb-4"> {currentEvent.description} </p>}
          <div className="text-gray-600 text-sm space-y-2 mb-4">
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
              {new Date(currentEvent.date).toLocaleDateString('it-IT')} alle {currentEvent.time}
            </p>
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"> </path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg>
              {currentEvent.locationName || 'Nessuna posizione specificata'}
            </p>
            {
              (currentEvent.taggedUsers && currentEvent.taggedUsers.length > 0) && (
                <p className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"> </path></svg>
                  Taggati: {(currentEvent.taggedUsers || []).join(', ')}
                </p>
              )
            }
            {currentEvent.knotIds && currentEvent.knotIds.length > 0 && (
              <p className="flex items-center text-sm text-gray-600">
                <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                Parte di Knot: {currentEvent.knotIds.join(', ')}
              </p>
            )}
            <p className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"> </path></svg>
              Stato: {currentEvent.isPublic ? 'Pubblico' : 'Privato'}
            </p>
          </div>

          <div className="flex items-center justify-around border-t border-b border-gray-200 py-3 mb-4">
            <button onClick={() => onLikeToggle(currentEvent.id, isLiked || false, currentEvent.isPublic, currentEvent.creatorId)} className="flex items-center space-x-1 text-gray-600 hover:text-red-500 transition-colors">
              <svg className={`w-5 h-5 ${isLiked ? 'text-red-500' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"> </path></svg>
            <span className="text-sm"> {currentEvent.likes ? currentEvent.likes.length : 0} </span>
            </button>
            <button className="flex items-center space-x-1 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" clipRule="evenodd"></path></svg>
              <span className="text-sm"> {comments.length} </span>
            </button>
            <button onClick={() => onShareEvent(currentEvent)} className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"> </path></svg>
              <span className="text-sm">Condividi</span>
            </button>
            {isOwnEvent && (
              <button
                onClick={() => onAddSpotToKnot(currentEvent)}
                className="flex items-center space-x-1 text-gray-600 hover:text-blue-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-sm">Aggiungi a Knot</span>
              </button>
            )}
          </div>

          {
            activeTab === 'taggedEvents' && isTaggedEvent && (
              <button
                onClick={() => { onRemoveTagFromEvent(currentEvent.id); onClose(); }}
                className="mt-4 px-4 py-2 rounded-lg font-bold bg-red-100 text-red-800 hover:bg-red-200 transition-colors duration-200"
              >
                Rimuovi Tag
              </button>
            )
          }

          <div className="mt-6">
            <h4 className="text-xl font-bold text-gray-800 mb-3"> Commenti </h4>
            {
              loadingComments ? (
                <LoadingSpinner message="Caricamento commenti..." />
              ) : comments.length === 0 ? (
                <p className="text-gray-600 text-sm"> Nessun commento. Sii il primo a commentare! </p>
              ) : (
                <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                  {
                    displayedComments.map(comment => (
                      <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-800"> {comment.username} </p>
                        <p className="text-gray-700 text-sm"> {comment.text} </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleString('it-IT') : 'Data sconosciuta'}
                        </p>
                      </div>
                    ))
                  }
                  {
                    comments.length > 3 && !showAllComments && (
                      <button
                        onClick={() => setShowAllComments(true)}
                        className="text-sm text-gray-600 hover:text-gray-800 underline mt-2"
                      >
                        Mostra tutti i {comments.length} commenti
                      </button>
                    )
                  }
                </div>
              )
            }
            <div className="mt-4 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Aggiungi un commento..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <button
                onClick={handleAddCommentSubmit}
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

export default EventDetailModal;
