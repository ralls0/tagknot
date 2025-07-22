import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, collection, query, where, orderBy, onSnapshot, getDoc, updateDoc, arrayRemove, arrayUnion, writeBatch, addDoc, serverTimestamp, Timestamp, getDocs } from 'firebase/firestore';

// Import Firebase services from the centralized config file
import { auth, db } from './firebaseConfig';

// Import shared interfaces
import { EventType, NotificationData, KnotType, EventData } from './interfaces';

// Import components
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import Navbar from './components/Navbar';
import CreateContentPage from './components/CreateContentPage';
import UserProfileDisplay from './components/UserProfileDisplay';
import SettingsPage from './components/SettingsPage';
import NotificationsPage from './components/NotificationsPage';
import EventDetailModal from './components/EventDetailModal';
import ShareEventModal from './components/ShareEventModal';
import ConfirmationModal from './components/ConfirmationModal';
import LoadingSpinner from './components/LoadingSpinner';
import EditSpotModal from './components/EditSpotModal';
import AddSpotToKnotModal from './components/AddSpotToKnotModal';
import EditKnotModal from './components/EditKnotModal';
import KnotDetailModal from './components/KnotDetailModal'; // Importa il nuovo componente

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

  // Stati per il nuovo modale di modifica spot
  const [showEditSpotModal, setShowEditSpotModal] = useState(false);
  const [eventToEditInModal, setEventToEditInModal] = useState<EventType | null>(null);

  // Stati per il modale "Aggiungi a Knot"
  const [showAddSpotToKnotModal, setShowAddSpotToKnot] = useState(false);
  const [spotToAddtoKnot, setSpotToAddtoKnot] = useState<EventType | null>(null);

  // Stati per il modale di modifica knot
  const [showEditKnotModal, setShowEditKnotModal] = useState(false);
  const [knotToEditInModal, setKnotToEditInModal] = useState<KnotType | null>(null);

  // Stati per il nuovo modale di dettaglio knot
  const [showKnotDetailModal, setShowKnotDetailModal] = useState(false);
  const [selectedKnotForModal, setSelectedKnotForModal] = useState<KnotType | null>(null);


  // Stati per i modali di conferma eliminazione
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'event' | 'knot'; isPublic?: boolean; creatorId?: string } | null>(null);

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
    setShowEditSpotModal(false); // Reset del modale di modifica spot
    setEventToEditInModal(null); // Reset dell'evento da modificare
    setShowAddSpotToKnot(false); // Reset del modale aggiungi a knot
    setSpotToAddtoKnot(null); // Reset dello spot da aggiungere a knot
    setShowEditKnotModal(false); // Reset del modale di modifica knot
    setKnotToEditInModal(null); // Reset del knot da modificare
    setShowKnotDetailModal(false); // Reset del modale di dettaglio knot
    setSelectedKnotForModal(null); // Reset del knot da visualizzare
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

  const handleContentCreated = () => { // Rinominato da handleEventCreated
    handleNavigate('myProfile');
  };

  const handleDeleteItem = (id: string, type: 'event' | 'knot', isPublic?: boolean, creatorId?: string) => {
    setItemToDelete({ id, type, isPublic, creatorId });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !userId) {
      console.error("Deletion failed: itemToDelete or userId is missing.");
      return;
    }

    const { id, type, isPublic, creatorId } = itemToDelete;
    const batch = writeBatch(db);

    try {
      if (type === 'event') {
        console.log(`Tentativo di eliminare l'evento: ${id}. Pubblico: ${isPublic}. ID Creatore: ${creatorId}. ID Utente Corrente: ${userId}`);

        // Elimina dalla collezione privata dell'utente
        const privateEventDocRef = doc(db, `artifacts/${appId}/users/${userId}/events`, id);
        batch.delete(privateEventDocRef);
        console.log(`Aggiunta eliminazione evento privato per ${id} al batch.`);

        // Se l'evento è marcato come pubblico, elimina anche dalla collezione pubblica
        if (isPublic) {
          const publicEventDocRef = doc(db, `artifacts/${appId}/public/data/events`, id);
          batch.delete(publicEventDocRef);
          console.log(`Aggiunta eliminazione evento pubblico per ${id} al batch.`);
        }

        // Pulisci i riferimenti nei knot (sia pubblici che privati, se di proprietà dell'utente corrente)
        const knotsToUpdateQueries = [
          query(collection(db, `artifacts/${appId}/public/data/knots`), where('spotIds', 'array-contains', id)),
          query(collection(db, `artifacts/${appId}/users/${userId}/knots`), where('spotIds', 'array-contains', id))
        ];

        for (const q of knotsToUpdateQueries) {
          const snapshot = await getDocs(q);
          snapshot.forEach(knotDoc => {
            // Aggiorna solo se l'utente corrente è il creatore del knot (a causa delle regole di sicurezza)
            if (knotDoc.data().creatorId === userId) {
              console.log(`Rimozione evento ${id} dal knot ${knotDoc.id} (di proprietà dell'utente corrente).`);
              batch.update(knotDoc.ref, { spotIds: arrayRemove(id) });
            } else {
              console.log(`Saltata l'aggiornamento per il knot ${knotDoc.id} (non di proprietà dell'utente corrente).`);
            }
          });
        }

      } else if (type === 'knot') {
        console.log(`Tentativo di eliminare il knot: ${id}. Pubblico: ${isPublic}. ID Creatore: ${creatorId}. ID Utente Corrente: ${userId}`);

        // Elimina dalla collezione privata dell'utente
        const privateKnotDocRef = doc(db, `artifacts/${appId}/users/${userId}/knots`, id);
        batch.delete(privateKnotDocRef);
        console.log(`Aggiunta eliminazione knot privato per ${id} al batch.`);

        // Se il knot è marcato come pubblico, elimina anche dalla collezione pubblica
        if (isPublic) {
          const publicKnotDocRef = doc(db, `artifacts/${appId}/public/data/knots`, id);
          batch.delete(publicKnotDocRef);
          console.log(`Aggiunta eliminazione knot pubblico per ${id} al batch.`);
        }

        // Pulisci i riferimenti negli eventi (sia pubblici che privati, se di proprietà dell'utente corrente)
        const eventsToUpdateQueries = [
          query(collection(db, `artifacts/${appId}/public/data/events`), where('knotIds', 'array-contains', id)),
          query(collection(db, `artifacts/${appId}/users/${userId}/events`), where('knotIds', 'array-contains', id))
        ];

        for (const q of eventsToUpdateQueries) {
          const snapshot = await getDocs(q);
          snapshot.forEach(eventDoc => {
            // Aggiorna solo se l'utente corrente è il creatore dell'evento (a causa delle regole di sicurezza)
            if (eventDoc.data().creatorId === userId) {
              console.log(`Rimozione knot ${id} dall'evento ${eventDoc.id} (di proprietà dell'utente corrente).`);
              batch.update(eventDoc.ref, { knotIds: arrayRemove(id) });
            } else {
              console.log(`Saltata l'aggiornamento per l'evento ${eventDoc.id} (non di proprietà dell'utente corrente).`);
            }
          });
        }
      }

      await batch.commit();
      console.log(`${type} eliminato con successo!`);
      handleNavigate('myProfile'); // Naviga dopo l'eliminazione riuscita
    } catch (error) {
      console.error(`Errore durante l'eliminazione di ${type}:`, error);
      // Potresti voler mostrare un AlertMessage qui
    } finally {
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
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
        const eventData = eventSnap.data() as EventType;
        const currentTaggedUsers = eventData.taggedUsers || [];
        const currentUserProfileTag = userProfile.profileTag || (currentUser.email ? currentUser.email.split('@')[0] : '');

        if (currentTaggedUsers.includes(currentUserProfileTag)) {
          await updateDoc(eventRef, {
            taggedUsers: arrayRemove(currentUserProfileTag)
          });
          console.log("Tag rimosso con successo!");
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

  // Callback per aggiornare l'evento selezionato nel modale dopo un'azione (es. commento, like)
  const handleUpdateSelectedEvent = (updatedEvent: EventType) => {
    setSelectedEventForModal(updatedEvent);
    // Aggiorna anche l'evento correlato nell'array se presente
    setRelatedEventsForModal(prevEvents =>
      prevEvents.map(e => (e.id === updatedEvent.id ? updatedEvent : e))
    );
  };

  // Modificata per gestire like su eventi pubblici e privati
  const handleLikeToggle = async (eventId: string, isLiked: boolean, eventIsPublic: boolean, eventCreatorId: string) => {
    if (!currentUser || !userId || !userProfile) return;

    const batch = writeBatch(db);
    const likeUpdate = isLiked ? arrayRemove(userId) : arrayUnion(userId);

    const privateEventRef = doc(db, `artifacts/${appId}/users/${eventCreatorId}/events`, eventId);

    // Se l'evento è pubblico, aggiorna il documento pubblico
    if (eventIsPublic) {
      const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
      const publicEventDocSnap = await getDoc(publicEventRef);
      if (publicEventDocSnap.exists()) {
        batch.update(publicEventRef, {
          likes: likeUpdate
        });
      } else {
        console.warn("Evento pubblico non trovato per il toggle like, ma eventIsPublic era true. Salto l'aggiornamento pubblico.");
      }
    }

    // Aggiorna il documento privato dell'evento se l'utente corrente è il creatore
    // Questo è necessario per mantenere la consistenza tra pubblico e privato per gli eventi dell'utente
    if (eventCreatorId === userId) {
      const privateEventDocSnap = await getDoc(privateEventRef);
      if (privateEventDocSnap.exists()) {
        batch.update(privateEventRef, {
          likes: likeUpdate
        });
      } else {
        console.warn("Evento privato non trovato per il toggle like, anche se l'utente corrente è il creatore. Salto l'aggiornamento privato.");
      }
    }

    try {
      await batch.commit();

      // Dopo l'aggiornamento di Firestore, recupera l'evento aggiornato e aggiorna lo stato del modale
      let updatedEventSnap;
      if (eventIsPublic) {
        updatedEventSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId));
      } else {
        // Se l'evento non è pubblico, recupera la versione privata per l'aggiornamento del modale
        updatedEventSnap = await getDoc(privateEventRef);
      }

      if (updatedEventSnap && updatedEventSnap.exists()) {
        // Chiamata a handleUpdateSelectedEvent per aggiornare lo stato dell'evento nel componente padre
        handleUpdateSelectedEvent({ id: updatedEventSnap.id, ...(updatedEventSnap.data() as EventData) } as EventType);
      }

      // Logica per la notifica solo se non è il proprio evento e se è stato aggiunto un like (non rimosso)
      if (eventCreatorId !== userId && !isLiked) {
        // Recupera i dati più recenti dell'evento per la notifica
        const eventDocForNotification = updatedEventSnap?.data() as EventData | undefined;

        const notificationData: NotificationData = {
          type: 'like',
          fromUserId: userId,
          fromUsername: userProfile.username,
          eventId: eventId,
          eventTag: eventDocForNotification?.tag || selectedEventForModal?.tag || 'N/A',
          message: `${userProfile.username} ha messo "Mi piace" al tuo evento: ${eventDocForNotification?.tag || selectedEventForModal?.tag || 'N/A'}`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: eventDocForNotification?.coverImage || selectedEventForModal?.coverImage || '',
        };
        await addDoc(collection(db, `artifacts/${appId}/users/${eventCreatorId}/notifications`), notificationData);
      }
    } catch (error) {
      console.error("Errore durante il toggle like:", error);
    }
  };

  const handleShareEvent = (event: EventType) => {
    setEventToShare(event);
    setShowShareModal(true);
  };

  // Funzione per mostrare il modale di visualizzazione dettagli (per Spot)
  const handleShowEventDetail = (item: EventType | KnotType, relatedEvents: EventType[] = [], activeTab: string = '', isShareAction: boolean = false) => {
    // Se l'item è un Knot, non aprire EventDetailModal, ma KnotDetailModal
    if (item.type === 'knot') {
      handleShowKnotDetail(item as KnotType); // Chiamata al nuovo handler per i Knot
      return;
    }
    // Se l'item è un EventType, procedi con EventDetailModal
    const event = item as EventType;
    setSelectedEventForModal(event);
    setRelatedEventsForModal(relatedEvents);
    setModalActiveTab(activeTab);
    setInitialEventIndexForModal(relatedEvents.findIndex(e => e.id === event.id));
    setShowEditSpotModal(false);
    setShowAddSpotToKnot(false);
    setShowEditKnotModal(false);
    setShowKnotDetailModal(false); // Assicurati che il modale Knot sia chiuso

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
    setShowEventDetailModal(false);
    setShowAddSpotToKnot(false);
    setShowEditKnotModal(false);
    setShowKnotDetailModal(false); // Assicurati che il modale Knot sia chiuso
  };

  const handleEditSaveSuccess = () => {
    setShowEditSpotModal(false);
  };

  // Funzione per mostrare il modale "Aggiungi a Knot"
  const handleAddSpotToKnot = (spot: EventType) => {
    setSpotToAddtoKnot(spot);
    setShowAddSpotToKnot(true);
    setShowEventDetailModal(false);
    setShowEditSpotModal(false);
    setShowEditKnotModal(false);
    setShowKnotDetailModal(false); // Assicurati che il modale Knot sia chiuso
  };

  const handleAddSpotToKnotSuccess = () => {
    setShowAddSpotToKnot(false);
    setSpotToAddtoKnot(null);
  };

  // Funzione per mostrare il modale di modifica del knot
  const handleEditKnotInModal = (knot: KnotType) => {
    setKnotToEditInModal(knot);
    setShowEditKnotModal(true);
    setShowEventDetailModal(false);
    setShowEditSpotModal(false);
    setShowAddSpotToKnot(false);
    setShowKnotDetailModal(false); // Assicurati che il modale Knot sia chiuso
  };

  const handleKnotEditSaveSuccess = () => {
    setShowEditKnotModal(false);
  };

  // NUOVA FUNZIONE: per mostrare il modale di dettaglio Knot
  const handleShowKnotDetail = (knot: KnotType) => {
    setSelectedKnotForModal(knot);
    setShowKnotDetailModal(true);
    setShowEventDetailModal(false); // Chiudi gli altri modali
    setShowEditSpotModal(false);
    setShowAddSpotToKnot(false);
    setShowEditKnotModal(false);
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
            {currentPage === 'createEvent' && <CreateContentPage onEventCreated={handleContentCreated} onCancelEdit={() => handleNavigate('myProfile')} />}
            {
              currentPage === 'myProfile' && userId && <UserProfileDisplay userIdToDisplay={userId} onNavigate={handleNavigate} onEditEvent={handleEditEventInModal} onDeleteEvent={async (eventId, isPublic) => handleDeleteItem(eventId, 'event', isPublic)} onRemoveTagFromEvent={handleRemoveTagFromEvent} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} onAddSpotToKnot={handleAddSpotToKnot} onEditKnot={handleEditKnotInModal} onDeleteKnot={async (knotId, isPublic, creatorId) => handleDeleteItem(knotId, 'knot', isPublic, creatorId)} onShowKnotDetail={handleShowKnotDetail} />} {/* Passa onShowKnotDetail */}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}

            {currentPage === 'userProfile' && viewedUserId && <UserProfileDisplay userIdToDisplay={viewedUserId} onNavigate={handleNavigate} onShowEventDetail={handleShowEventDetail} onLikeToggle={handleLikeToggle} onEditEvent={handleEditEventInModal} onDeleteEvent={async (eventId, isPublic) => handleDeleteItem(eventId, 'event', isPublic)} onRemoveTagFromEvent={async (eventId) => handleRemoveTagFromEvent(eventId)} onAddSpotToKnot={handleAddSpotToKnot} onEditKnot={handleEditKnotInModal} onDeleteKnot={async (knotId, isPublic, creatorId) => handleDeleteItem(knotId, 'knot', isPublic, creatorId)} onShowKnotDetail={handleShowKnotDetail} />} {/* Passa onShowKnotDetail */}
            {currentPage === 'notifications' && <NotificationsPage setUnreadNotificationsCount={setUnreadNotificationsCount} />}
          </main>
          {
            showEventDetailModal && selectedEventForModal && (
              <EventDetailModal
                key={selectedEventForModal.id}
                event={selectedEventForModal}
                onClose={() => setShowEventDetailModal(false)}
                relatedEvents={relatedEventsForModal}
                initialIndex={initialEventIndexForModal}
                activeTab={modalActiveTab}
                onRemoveTagFromEvent={handleRemoveTagFromEvent}
                onLikeToggle={handleLikeToggle}
                onShareEvent={handleShareEvent}
                onUpdateEvent={handleUpdateSelectedEvent}
                onAddSpotToKnot={handleAddSpotToKnot}
              />
            )}
          {
            showEditSpotModal && eventToEditInModal && (
              <EditSpotModal
                key={eventToEditInModal.id}
                event={eventToEditInModal}
                onClose={() => setShowEditSpotModal(false)}
                onSaveSuccess={handleEditSaveSuccess}
              />
            )}
          {
            showAddSpotToKnotModal && spotToAddtoKnot && (
              <AddSpotToKnotModal
                spot={spotToAddtoKnot}
                onClose={() => setShowAddSpotToKnot(false)}
                onAddSuccess={handleAddSpotToKnotSuccess}
              />
            )}
          {
            showEditKnotModal && knotToEditInModal && (
              <EditKnotModal
                key={knotToEditInModal.id}
                knot={knotToEditInModal}
                onClose={() => setShowEditKnotModal(false)}
                onSaveSuccess={handleKnotEditSaveSuccess}
              />
            )}
          {
            showKnotDetailModal && selectedKnotForModal && (
              <KnotDetailModal
                key={selectedKnotForModal.id}
                knot={selectedKnotForModal}
                onClose={() => setShowKnotDetailModal(false)}
                onShowEventDetail={handleShowEventDetail}
                onLikeToggle={handleLikeToggle}
                onShareEvent={handleShareEvent}
                onAddSpotToKnot={handleAddSpotToKnot}
                onEditEvent={handleEditEventInModal} // Passa la funzione per modificare uno spot dal KnotDetailModal
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
            message={`Sei sicuro di voler eliminare questo ${itemToDelete?.type === 'event' ? 'spot' : 'knot'}?`}
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
