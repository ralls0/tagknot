import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, collection, query, where, orderBy, onSnapshot, getDoc, updateDoc, arrayRemove, arrayUnion, writeBatch, addDoc, serverTimestamp, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';

// Import Firebase services from the centralized config file
import { auth, db } from './firebaseConfig';

// Import shared interfaces
import { EventType, NotificationData, KnotType, EventData, GroupType } from './interfaces';

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
import KnotDetailModal from './components/KnotDetailModal';
import GroupsPage from './components/GroupsPage';
import CreateGroupModal from './components/CreateGroupModal';
import GroupProfileDisplay from './components/GroupProfileDisplay';
import EditGroupModal from './components/EditGroupModal';

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

  // NUOVI STATI PER I GRUPPI
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showGroupProfileDisplay, setShowGroupProfileDisplay] = useState(false);
  const [selectedGroupForDisplay, setSelectedGroupForDisplay] = useState<GroupType | null>(null);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [groupToEditInModal, setGroupToEditInModal] = useState<GroupType | null>(null);


  // Stati per i modali di conferma eliminazione
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'event' | 'knot'; isPublic?: boolean; creatorId?: string; groupId?: string } | null>(null);

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
    setShowEditSpotModal(false);
    setEventToEditInModal(null);
    setShowAddSpotToKnot(false);
    setSpotToAddtoKnot(null);
    setShowEditKnotModal(false);
    setKnotToEditInModal(null);
    setShowKnotDetailModal(false);
    setSelectedKnotForModal(null);
    setShowCreateGroupModal(false);
    setShowGroupProfileDisplay(false);
    setSelectedGroupForDisplay(null); // Resetta selectedGroupForDisplay
    setShowEditGroupModal(false);
    setGroupToEditInModal(null);
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

  const handleContentCreated = () => {
    handleNavigate('myProfile');
  };

  // Aggiornata la firma per includere groupId e rendere isPublic e creatorId obbligatori
  const handleDeleteItem = async (id: string, type: 'event' | 'knot', isPublic: boolean, creatorId: string, groupId?: string): Promise<void> => {
    setItemToDelete({ id, type, isPublic, creatorId, groupId });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !userId) {
      console.error("Deletion failed: itemToDelete or userId is missing.");
      return;
    }

    const { id, type, isPublic, creatorId, groupId } = itemToDelete; // Destruttura groupId
    const batch = writeBatch(db);

    try {
      // Determina la collezione di origine (privata dell'utente o di un gruppo)
      let itemDocRef;
      if (groupId) {
        itemDocRef = doc(db, `artifacts/${appId}/public/data/groups/${groupId}/${type}s`, id);
      } else {
        itemDocRef = doc(db, `artifacts/${appId}/users/${userId}/${type}s`, id);
      }

      // Elimina dalla collezione di origine
      batch.delete(itemDocRef);
      console.log(`Aggiunta eliminazione ${type} da collezione di origine per ${id} al batch.`);

      // Se l'elemento era pubblico (e non in un gruppo), elimina anche dalla collezione pubblica globale
      if (isPublic && !groupId) { // Aggiunto controllo groupId
        const publicItemDocRef = doc(db, `artifacts/${appId}/public/data/${type}s`, id);
        batch.delete(publicItemDocRef);
        console.log(`Aggiunta eliminazione ${type} pubblico per ${id} al batch.`);
      }

      // Pulisci i riferimenti nei knot (se è un evento) o negli eventi (se è un knot)
      if (type === 'event') {
        const knotsToUpdateQueries = [
          query(collection(db, `artifacts/${appId}/public/data/knots`), where('spotIds', 'array-contains', id)),
          query(collection(db, `artifacts/${appId}/users/${userId}/knots`), where('spotIds', 'array-contains', id))
        ];
        for (const q of knotsToUpdateQueries) {
          const snapshot = await getDocs(q);
          snapshot.forEach(knotDoc => {
            if (knotDoc.data().creatorId === userId) {
              batch.update(knotDoc.ref, { spotIds: arrayRemove(id) });
            }
          });
        }
        // Anche per i knot dei gruppi
        const groupKnotsQuery = query(collectionGroup(db, 'knots'), where('spotIds', 'array-contains', id));
        const groupKnotsSnapshot = await getDocs(groupKnotsQuery);
        groupKnotsSnapshot.forEach(knotDoc => {
          // Solo se l'utente corrente è membro del gruppo che possiede il knot
          // (Le regole di sicurezza di Firestore gestiranno i permessi effettivi)
          batch.update(knotDoc.ref, { spotIds: arrayRemove(id) });
        });

      } else if (type === 'knot') {
        const eventsToUpdateQueries = [
          query(collection(db, `artifacts/${appId}/public/data/events`), where('knotIds', 'array-contains', id)),
          query(collection(db, `artifacts/${appId}/users/${userId}/events`), where('knotIds', 'array-contains', id))
        ];
        for (const q of eventsToUpdateQueries) {
          const snapshot = await getDocs(q);
          snapshot.forEach(eventDoc => {
            if (eventDoc.data().creatorId === userId) {
              batch.update(eventDoc.ref, { knotIds: arrayRemove(id) });
            }
          });
        }
        // Anche per gli eventi dei gruppi
        const groupEventsQuery = query(collectionGroup(db, 'events'), where('knotIds', 'array-contains', id));
        const groupEventsSnapshot = await getDocs(groupEventsQuery);
        groupEventsSnapshot.forEach(eventDoc => {
          // Solo se l'utente corrente è membro del gruppo che possiede l'evento
          // (Le regole di sicurezza di Firestore gestiranno i permessi effettivi)
          batch.update(eventDoc.ref, { knotIds: arrayRemove(id) });
        });
      }

      await batch.commit();
      console.log(`${type} eliminato con successo!`);
      handleNavigate('myProfile');
    } catch (error) {
      console.error(`Errore durante l'eliminazione di ${type}:`, error);
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

    let eventDocRef;
    let eventData: EventData | undefined;

    // 1. Prova a recuperare l'evento dalla collezione pubblica globale
    const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    const publicEventSnap = await getDoc(publicEventRef);

    if (publicEventSnap.exists()) {
      eventDocRef = publicEventRef;
      eventData = publicEventSnap.data() as EventData;
    } else {
      // 2. Se non è pubblico, prova a recuperarlo dalla collezione privata del creatore
      const privateEventRef = doc(db, `artifacts/${appId}/users/${eventCreatorId}/events`, eventId);
      const privateEventSnap = await getDoc(privateEventRef);

      if (privateEventSnap.exists()) {
        eventDocRef = privateEventRef;
        eventData = privateEventSnap.data() as EventData;
      } else {
        // 3. Se non è né pubblico né privato dell'utente, prova a cercarlo in tutti i gruppi (tramite collectionGroup)
        // Questa parte è più complessa perché collectionGroup non supporta getDoc diretto per ID.
        // Dobbiamo fare una query e poi filtrare.
        const groupEventsQuery = query(collectionGroup(db, 'events'), where('__name__', '==', `artifacts/${appId}/public/data/groups/${eventCreatorId}/events/${eventId}`)); // This line is incorrect as __name__ needs full path
        // Correction: We need to iterate through possible group paths if we don't have groupId
        // Given that eventCreatorId is passed, it's more likely the event is either in public/data/events
        // or in users/eventCreatorId/events. If it's a group event, the groupId should ideally be passed.
        // For now, let's assume eventCreatorId is sufficient for private events.
        // If it's a group event, the event object itself should carry groupId.
        // Let's refine the logic to check for groupId in the existing selectedEventForModal or event object.

        // If the event object already has a groupId, we can construct the path directly
        if (selectedEventForModal?.groupId) {
          const groupEventRef = doc(db, `artifacts/${appId}/public/data/groups/${selectedEventForModal.groupId}/events`, eventId);
          const groupEventSnap = await getDoc(groupEventRef);
          if (groupEventSnap.exists()) {
            eventDocRef = groupEventRef;
            eventData = groupEventSnap.data() as EventData;
          }
        }

        if (!eventDocRef) {
          console.warn("Evento non trovato in nessuna collezione per il toggle like.");
          return;
        }
      }
    }

    if (!eventDocRef || !eventData) {
      console.warn("Documento evento non trovato o dati mancanti per il toggle like.");
      return;
    }

    batch.update(eventDocRef, {
      likes: likeUpdate
    });

    try {
      await batch.commit();

      // Dopo l'aggiornamento di Firestore, recupera l'evento aggiornato e aggiorna lo stato del modale
      let updatedEventSnap = await getDoc(eventDocRef); // Recupera dal percorso che è stato effettivamente modificato

      if (updatedEventSnap && updatedEventSnap.exists()) {
        handleUpdateSelectedEvent({ id: updatedEventSnap.id, ...(updatedEventSnap.data() as EventData) } as EventType);
      }

      // Logica per la notifica solo se non è il proprio evento e se è stato aggiunto un like (non rimosso)
      if (eventCreatorId !== userId && !isLiked) {
        const notificationData: NotificationData = {
          type: 'like',
          fromUserId: userId,
          fromUsername: userProfile.username,
          eventId: eventId,
          eventTag: eventData?.tag || selectedEventForModal?.tag || 'N/A',
          message: `${userProfile.username} ha messo "Mi piace" al tuo evento: ${eventData?.tag || selectedEventForModal?.tag || 'N/A'}`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: eventData?.coverImage || selectedEventForModal?.coverImage || '',
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

  // Funzione per mostrare il modale di visualizzazione dettagli (per Spot e Knot)
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
    setShowKnotDetailModal(false);
    setShowCreateGroupModal(false);
    setShowGroupProfileDisplay(false);
    setShowEditGroupModal(false);


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
    setShowKnotDetailModal(false);
    setShowCreateGroupModal(false);
    setShowGroupProfileDisplay(false);
    setShowEditGroupModal(false);
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
    setShowKnotDetailModal(false);
    setShowCreateGroupModal(false);
    setShowGroupProfileDisplay(false);
    setShowEditGroupModal(false);
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
    setShowKnotDetailModal(false);
    setShowCreateGroupModal(false);
    setShowGroupProfileDisplay(false);
    setShowEditGroupModal(false);
  };

  const handleKnotEditSaveSuccess = () => {
    setShowEditKnotModal(false);
  };

  // NUOVA FUNZIONE: per mostrare il modale di dettaglio Knot
  const handleShowKnotDetail = (knot: KnotType) => {
    setSelectedKnotForModal(knot);
    setShowKnotDetailModal(true);
    setShowEventDetailModal(false);
    setShowEditSpotModal(false);
    setShowAddSpotToKnot(false);
    setShowEditKnotModal(false);
    setShowCreateGroupModal(false);
    setShowGroupProfileDisplay(false);
    setShowEditGroupModal(false);
  };

  // NUOVE FUNZIONI PER I GRUPPI
  const handleShowCreateGroup = () => {
    setShowCreateGroupModal(true);
    setShowEventDetailModal(false);
    setShowEditSpotModal(false);
    setShowAddSpotToKnot(false);
    setShowEditKnotModal(false);
    setShowKnotDetailModal(false);
    setShowGroupProfileDisplay(false);
    setShowEditGroupModal(false);
  };

  const handleCreateGroupSuccess = (groupId: string) => {
    setShowCreateGroupModal(false);
    handleNavigate('groupProfile', groupId); // Naviga alla vista del gruppo appena creato
  };

  // Modificata per impostare selectedGroupForDisplay
  const handleShowGroupDetail = (group: GroupType) => {
    setSelectedGroupForDisplay(group); // Imposta il gruppo selezionato
    setShowGroupProfileDisplay(true); // Mostra il componente GroupProfileDisplay
    // Chiudi tutti gli altri modali/pagine che potrebbero sovrapporsi
    setShowEventDetailModal(false);
    setShowEditSpotModal(false);
    setShowAddSpotToKnot(false);
    setShowEditKnotModal(false);
    setShowKnotDetailModal(false);
    setShowCreateGroupModal(false);
    setShowEditGroupModal(false);
    setCurrentPage('groupProfile'); // Assicurati che la pagina corrente sia 'groupProfile'
  };

  // NUOVA FUNZIONE: per mostrare il modale di modifica gruppo
  const handleEditGroupInModal = (groupId: string) => {
    if (selectedGroupForDisplay && selectedGroupForDisplay.id === groupId) {
      setGroupToEditInModal(selectedGroupForDisplay);
      setShowEditGroupModal(true);
    } else {
      const fetchGroupAndOpenModal = async () => {
        try {
          const groupRef = doc(db, `artifacts/${appId}/public/data/groups`, groupId);
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            const data = groupSnap.data() as Omit<GroupType, 'id'>;
            setGroupToEditInModal({ id: groupSnap.id, ...data });
            setShowEditGroupModal(true);
            setShowEventDetailModal(false);
            setShowEditSpotModal(false);
            setShowAddSpotToKnot(false);
            setShowEditKnotModal(false);
            setShowKnotDetailModal(false);
            setShowCreateGroupModal(false);
            setShowGroupProfileDisplay(false);
          } else {
            console.error("Gruppo non trovato per la modifica:", groupId);
          }
        } catch (error) {
          console.error("Errore nel recupero del gruppo per la modifica:", error);
        }
      };
      fetchGroupAndOpenModal();
    }
  };

  const handleEditGroupSaveSuccess = () => {
    setShowEditGroupModal(false);
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
              currentPage === 'myProfile' && userId && <UserProfileDisplay
                userIdToDisplay={userId}
                onNavigate={handleNavigate}
                onEditEvent={handleEditEventInModal}
                onDeleteEvent={(eventId, isPublic, creatorId, groupId) => handleDeleteItem(eventId, 'event', isPublic, creatorId, groupId)}
                onRemoveTagFromEvent={handleRemoveTagFromEvent}
                onShowEventDetail={handleShowEventDetail}
                onLikeToggle={handleLikeToggle}
                onAddSpotToKnot={handleAddSpotToKnot}
                onEditKnot={handleEditKnotInModal}
                onDeleteKnot={(knotId, isPublic, creatorId, groupId) => handleDeleteItem(knotId, 'knot', isPublic, creatorId, groupId)}
                onShowKnotDetail={handleShowKnotDetail}
              />}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}

            {currentPage === 'userProfile' && viewedUserId && <UserProfileDisplay
              userIdToDisplay={viewedUserId}
              onNavigate={handleNavigate}
              onShowEventDetail={handleShowEventDetail}
              onLikeToggle={handleLikeToggle}
              onEditEvent={handleEditEventInModal}
              onDeleteEvent={(eventId, isPublic, creatorId, groupId) => handleDeleteItem(eventId, 'event', isPublic, creatorId, groupId)}
              onRemoveTagFromEvent={handleRemoveTagFromEvent}
              onAddSpotToKnot={handleAddSpotToKnot}
              onEditKnot={handleEditKnotInModal}
              onDeleteKnot={(knotId, isPublic, creatorId, groupId) => handleDeleteItem(knotId, 'knot', isPublic, creatorId, groupId)}
              onShowKnotDetail={handleShowKnotDetail}
            />}
            {currentPage === 'notifications' && <NotificationsPage setUnreadNotificationsCount={setUnreadNotificationsCount} />}
            {currentPage === 'groups' && <GroupsPage onShowCreateGroup={handleShowCreateGroup} onShowGroupDetail={handleShowGroupDetail} />}
            {currentPage === 'groupProfile' && selectedGroupForDisplay && <GroupProfileDisplay
              groupIdToDisplay={selectedGroupForDisplay.id}
              onNavigate={handleNavigate}
              onEditEvent={handleEditEventInModal}
              onDeleteEvent={(eventId, isPublic, creatorId, groupId) => handleDeleteItem(eventId, 'event', isPublic, creatorId, groupId)}
              onRemoveTagFromEvent={handleRemoveTagFromEvent}
              onShowEventDetail={handleShowEventDetail}
              onLikeToggle={handleLikeToggle}
              onAddSpotToKnot={handleAddSpotToKnot}
              onEditKnot={handleEditKnotInModal}
              onDeleteKnot={(knotId, isPublic, creatorId, groupId) => handleDeleteItem(knotId, 'knot', isPublic, creatorId, groupId)}
              onShowKnotDetail={handleShowKnotDetail}
            />}
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
                onEditEvent={handleEditEventInModal}
              />
            )}
          {
            showCreateGroupModal && (
              <CreateGroupModal
                onClose={() => setShowCreateGroupModal(false)}
                onCreateSuccess={handleCreateGroupSuccess}
              />
            )}
          {
            showEditGroupModal && groupToEditInModal && (
              <EditGroupModal
                key={groupToEditInModal.id}
                group={groupToEditInModal}
                onClose={() => setShowEditGroupModal(false)}
                onSaveSuccess={handleEditGroupSaveSuccess}
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
