import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, collection, query, where, orderBy, onSnapshot, getDoc, updateDoc, arrayRemove, arrayUnion, writeBatch, addDoc, serverTimestamp, Timestamp, increment } from 'firebase/firestore';

// Import Firebase services from the centralized config file
import { auth, db } from './firebaseConfig';

// Import shared interfaces
import { EventType, UserProfile, NotificationType, EventData, UserProfileData, CommentData, NotificationData } from './interfaces';

// Import components
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import Navbar from './components/Navbar';
// import HomePage from './components/HomePage'; // Commentato come richiesto
import CreateSpotPage from './components/CreateSpotPage'; // Rinominato da CreateEventPage
import UserProfileDisplay from './components/UserProfileDisplay';
import SettingsPage from './components/SettingsPage';
// import SearchPage from './components/SearchPage'; // Commentato come richiesto
import NotificationsPage from './components/NotificationsPage';
import EventDetailModal from './components/EventDetailModal';
import ShareEventModal from './components/ShareEventModal';
import ConfirmationModal from './components/ConfirmationModal';
import LoadingSpinner from './components/LoadingSpinner';
import EditSpotModal from './components/EditSpotModal'; // Importa il nuovo componente

// Hardcoded app ID for production - consider making this an environment variable if it changes per deployment
const appId = "tagknot-app";

// Main App Component
const App = () => {
  const { currentUser, loading, userId, userProfile } = useAuth();
  const [currentPage, setCurrentPage] = useState('myProfile');
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventType | null>(null);
  const [relatedEventsForModal, setRelatedEventsForModal] = useState<EventType[]>([]);
  const [initialEventIndexForModal, setInitialEventIndexForModal] = useState(0);
  const [modalActiveTab, setModalActiveTab] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [eventToShare, setEventToShare] = useState<EventType | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Stati per il nuovo modale di modifica
  const [showEditSpotModal, setShowEditSpotModal] = useState(false);
  const [eventToEditInModal, setEventToEditInModal] = useState<EventType | null>(null);


  // States for confirmation modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{ id: string; isPublic: boolean } | null>(null);
  const [showRemoveTagConfirm, setShowRemoveTagConfirm] = useState(false);
  const [eventToRemoveTagFrom, setEventToRemoveTagFrom] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      if (isMounted) setUnreadNotificationsCount(0);
      return;
    }

    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/notifications`),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isMounted) {
        setUnreadNotificationsCount(snapshot.size);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching unread notifications count:", error);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  const handleNavigate = (page: string, id: string | null = null) => {
    setCurrentPage(page);
    setViewedUserId(id);
    setShowEventDetailModal(false);
    setShowShareModal(false);
    setShowEditSpotModal(false); // Reset del modale di modifica
    setEventToEditInModal(null); // Reset dell'evento da modificare
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleNavigate('home');
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const handleLoginSuccess = () => {
    handleNavigate('myProfile');
  };

  const handleEventCreated = () => {
    handleNavigate('myProfile');
  };

  const handleDeleteEvent = async (eventId: string, isPublic: boolean) => {
    setEventToDelete({ id: eventId, isPublic: isPublic });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (eventToDelete && userId) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `artifacts/${appId}/users/${userId}/events`, eventToDelete.id));
        if (eventToDelete.isPublic) {
          batch.delete(doc(db, `artifacts/${appId}/public/data/events`, eventToDelete.id));
        }
        await batch.commit();
        console.log("Event deleted successfully!");
      } catch (error) {
        console.error("Error deleting event:", error);
      } finally {
        setShowDeleteConfirm(false);
        setEventToDelete(null);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEventToDelete(null);
  };

  const handleRemoveTagFromEvent = async (eventId: string) => {
    setEventToRemoveTagFrom(eventId);
    setShowRemoveTagConfirm(true);
  };

  const confirmRemoveTag = async () => {
    if (!currentUser || !userId || !eventToRemoveTagFrom || !userProfile) return;

    try {
      const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventToRemoveTagFrom);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const eventData = eventSnap.data() as EventData;
        const currentTaggedUsers = eventData.taggedUsers || [];
        const currentUserProfileTag = userProfile.profileTag || (currentUser.email ? currentUser.email.split('@')[0] : '');

        if (currentTaggedUsers.includes(currentUserProfileTag)) {
          await updateDoc(eventRef, {
            taggedUsers: arrayRemove(currentUserProfileTag)
          });
          console.log("Tag removed successfully!");
        } else {
          console.warn("User is not tagged in this event.");
        }
      }
    } catch (error) {
      console.error("Error removing tag:", error);
    } finally {
      setShowRemoveTagConfirm(false);
      setEventToRemoveTagFrom(null);
    }
  };

  const cancelRemoveTag = () => {
    setShowRemoveTagConfirm(false);
    setEventToRemoveTagFrom(null);
  };

  const handleLikeToggle = async (eventId: string, isLiked: boolean) => {
    if (!currentUser || !userId || !userProfile) return;

    const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    const eventDocSnap = await getDoc(publicEventRef);

    if (!eventDocSnap.exists()) {
      console.warn("Event not found for like toggle.");
      return;
    }

    const eventCreatorId = eventDocSnap.data().creatorId;
    const privateEventRef = doc(db, `artifacts/${appId}/users/${eventCreatorId}/events`, eventId);

    try {
      const batch = writeBatch(db);

      // Determina l'operazione in base allo stato attuale del "mi piace"
      const likeUpdate = isLiked ? arrayRemove(userId) : arrayUnion(userId);

      // Aggiorna il documento pubblico
      batch.update(publicEventRef, {
        likes: likeUpdate
      });

      // Se l'utente corrente è il creatore dell'evento, aggiorna anche il documento privato
      // Questo è importante per la coerenza della visualizzazione nel profilo del creatore
      if (eventCreatorId === userId) {
        batch.update(privateEventRef, {
          likes: likeUpdate
        });
      }

      await batch.commit();

      // Dopo l'aggiornamento di Firestore, recupera l'evento aggiornato e aggiorna lo stato del modale
      const updatedEventSnap = await getDoc(publicEventRef);
      if (updatedEventSnap.exists()) {
        setSelectedEventForModal({ id: updatedEventSnap.id, ...(updatedEventSnap.data() as EventData) });
      }

      // Logica per la notifica solo se non è il proprio evento e se è stato aggiunto un like (non rimosso)
      if (eventCreatorId !== userId && !isLiked) { // Notifica solo se il like è stato aggiunto
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
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddComment = async (eventId: string, commentText: string) => {
    console.log(`Comment for event ${eventId}: ${commentText}`);
  };

  const handleShareEvent = (event: EventType) => {
    setEventToShare(event);
    setShowShareModal(true);
  };

  // Funzione per mostrare il modale di visualizzazione dettagli
  const handleShowEventDetail = (event: EventType, relatedEvents: EventType[] = [], activeTab: string = '', isShareAction: boolean = false) => {
    setSelectedEventForModal(event);
    setRelatedEventsForModal(relatedEvents);
    setModalActiveTab(activeTab);
    setInitialEventIndexForModal(relatedEvents.findIndex(e => e.id === event.id));
    setShowEditSpotModal(false); // Assicurati che il modale di modifica sia chiuso

    if (isShareAction) {
      handleShareEvent(event);
    } else {
      setShowEventDetailModal(true);
    }
  };

  // Funzione per mostrare il modale di modifica dello spot
  const handleEditEventInModal = (event: EventType) => {
    setEventToEditInModal(event);
    setShowEditSpotModal(true);
    setShowEventDetailModal(false); // Assicurati che il modale di dettaglio sia chiuso
  };

  const handleEditSaveSuccess = () => {
    setShowEditSpotModal(false); // Chiudi il modale di modifica
    // Potresti voler ricaricare gli eventi o navigare, se necessario
    // handleNavigate('myProfile'); // Esempio: naviga al profilo dopo il salvataggio
  };


  if (loading) {
    return <LoadingSpinner message="Caricamento..." />;
  }

  return (
    <div className="App font-sans antialiased text-gray-800 bg-gray-100">
      {!currentUser ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <Navbar onNavigate={handleNavigate} onLogout={handleLogout} unreadNotificationsCount={unreadNotificationsCount} />
          <main className="pb-16 md:pb-0">
            {/* HomePage commentata come richiesto */}
            {/* {currentPage === 'home' && <HomePage onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} />} */}

            {/* CreateSpotPage è solo per la creazione */}
            {currentPage === 'createEvent' && <CreateSpotPage onEventCreated={handleEventCreated} onCancelEdit={() => handleNavigate('myProfile')} />}
            {
              currentPage === 'myProfile' && <UserProfileDisplay userIdToDisplay={userId || ''} onNavigate={handleNavigate} onEditEvent={handleEditEventInModal} onDeleteEvent={handleDeleteEvent} onRemoveTagFromEvent={handleRemoveTagFromEvent} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}

            {/* SearchPage commentata come richiesto */}
            {/* {currentPage === 'search' && <SearchPage onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} />} */}

            {currentPage === 'userProfile' && viewedUserId && <UserProfileDisplay userIdToDisplay={viewedUserId} onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} onEditEvent={handleEditEventInModal} onDeleteEvent={async () => { }} onRemoveTagFromEvent={async () => { }} />}
            {currentPage === 'notifications' && <NotificationsPage setUnreadNotificationsCount={setUnreadNotificationsCount} />}
          </main>
          {
            showEventDetailModal && selectedEventForModal && (
              <EventDetailModal
                key={selectedEventForModal.id} // Aggiunto key per forzare il re-mount e il reset dello stato
                event={selectedEventForModal}
                onClose={() => setShowEventDetailModal(false)}
                relatedEvents={relatedEventsForModal}
                initialIndex={initialEventIndexForModal}
                activeTab={modalActiveTab}
                onRemoveTagFromEvent={handleRemoveTagFromEvent}
                onLikeToggle={handleLikeToggle}
                onShareEvent={handleShareEvent}
              />
            )}
          {
            showEditSpotModal && eventToEditInModal && (
              <EditSpotModal
                key={eventToEditInModal.id} // Forza il re-mount per resettare lo stato interno
                event={eventToEditInModal}
                onClose={() => setShowEditSpotModal(false)}
                onSaveSuccess={handleEditSaveSuccess}
              />
            )}
          {
            showShareModal && eventToShare && (
              <ShareEventModal
                event={eventToShare}
                onClose={() => setShowShareModal(false)}
                onShareSuccess={() => {
                  setShowShareModal(false);
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
            onCancel={cancelDelete}
          />
        </>
      )}
    </div>
  );
};

// Wrapper for the App with AuthProvider
const AppWrapper = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWrapper;
