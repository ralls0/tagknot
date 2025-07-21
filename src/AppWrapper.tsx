import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, collection, query, where, orderBy, onSnapshot, getDoc, updateDoc, arrayRemove, arrayUnion, writeBatch, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

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

// Hardcoded app ID for production - consider making this an environment variable if it changes per deployment
const appId = "tagknot-app";

// Main App Component
const App = () => {
  const { currentUser, loading, userId, userProfile } = useAuth();
  // Modificato lo stato iniziale di currentPage da 'home' a 'myProfile'
  const [currentPage, setCurrentPage] = useState('myProfile');
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [eventToEdit, setEventToEdit] = useState<EventType | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventType | null>(null);
  const [relatedEventsForModal, setRelatedEventsForModal] = useState<EventType[]>([]);
  const [initialEventIndexForModal, setInitialEventIndexForModal] = useState(0);
  const [modalActiveTab, setModalActiveTab] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [eventToShare, setEventToShare] = useState<EventType | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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
    setEventToEdit(null);
    setShowEventDetailModal(false);
    setShowShareModal(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Dopo il logout, puoi reindirizzare alla pagina di login o a una home page pubblica
      handleNavigate('home');
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const handleLoginSuccess = () => {
    // Dopo il login, reindirizza alla pagina del profilo
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
    const privateEventRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventId); // Riferimento al documento privato

    try {
      const batch = writeBatch(db); // Usa un batch per aggiornamenti atomici

      if (isLiked) {
        batch.update(publicEventRef, {
          likes: arrayRemove(userId)
        });
        // Aggiorna anche il documento privato se esiste e l'utente è il creatore
        const eventDocSnap = await getDoc(publicEventRef);
        if (eventDocSnap.exists() && eventDocSnap.data().creatorId === userId) {
          batch.update(privateEventRef, {
            likes: arrayRemove(userId)
          });
        }
      } else {
        batch.update(publicEventRef, {
          likes: arrayUnion(userId)
        });
        // Aggiorna anche il documento privato se esiste e l'utente è il creatore
        const eventDocSnap = await getDoc(publicEventRef); // Ottieni i dati più recenti
        if (eventDocSnap.exists() && eventDocSnap.data().creatorId === userId) {
          batch.update(privateEventRef, {
            likes: arrayUnion(userId)
          });
        }

        // Logica per la notifica solo se non è il proprio evento
        if (eventDocSnap.exists() && eventDocSnap.data().creatorId !== userId) {
          const eventCreatorId = eventDocSnap.data().creatorId;
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
      }
      await batch.commit(); // Esegui tutte le operazioni del batch
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

  const handleShowEventDetail = (event: EventType, relatedEvents: EventType[] = [], activeTab: string = '', isShareAction: boolean = false) => {
    setSelectedEventForModal(event);
    setRelatedEventsForModal(relatedEvents);
    setModalActiveTab(activeTab);
    const index = relatedEvents.findIndex(e => e.id === event.id);
    setInitialEventIndexForModal(index !== -1 ? index : 0);
    if (isShareAction) {
      handleShareEvent(event);
    } else {
      setShowEventDetailModal(true);
    }
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

            {currentPage === 'createEvent' && <CreateSpotPage onEventCreated={handleEventCreated} eventToEdit={eventToEdit} onCancelEdit={() => handleNavigate('myProfile')} />}
            {
              currentPage === 'myProfile' && <UserProfileDisplay userIdToDisplay={userId || ''} onNavigate={handleNavigate} onEditEvent={(event) => {
                setEventToEdit(event);
                handleNavigate('createEvent');
              }} onDeleteEvent={handleDeleteEvent} onRemoveTagFromEvent={handleRemoveTagFromEvent} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}

            {/* SearchPage commentata come richiesto */}
            {/* {currentPage === 'search' && <SearchPage onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} />} */}

            {currentPage === 'userProfile' && viewedUserId && <UserProfileDisplay userIdToDisplay={viewedUserId} onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} onEditEvent={async () => { }} onDeleteEvent={async () => { }} onRemoveTagFromEvent={async () => { }} />}
            {currentPage === 'notifications' && <NotificationsPage setUnreadNotificationsCount={setUnreadNotificationsCount} />}
          </main>
          {
            showEventDetailModal && selectedEventForModal && (
              <EventDetailModal
                event={selectedEventForModal}
                onClose={() => setShowEventDetailModal(false)}
                relatedEvents={relatedEventsForModal}
                initialIndex={initialEventIndexForModal}
                activeTab={modalActiveTab}
                onRemoveTagFromEvent={handleRemoveTagFromEvent}
                onLikeToggle={handleLikeToggle}
                onAddComment={handleAddComment}
                onShareEvent={handleShareEvent}
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
