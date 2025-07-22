import React, { useState, useEffect } from 'react';
import { doc, collection, query, where, orderBy, onSnapshot, updateDoc, arrayRemove, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import EventCard from './EventCard';
import SpotCalendar from './SpotCalendar'; // Importa il nuovo componente del calendario
import KnotCard from './KnotCard'; // Nuovo componente per visualizzare i Knot
import { EventType, UserProfileData, UserProfile, EventData, KnotType, KnotData } from '../interfaces'; // Importa KnotType e KnotData

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const UserProfileDisplay = ({ userIdToDisplay, onNavigate, onEditEvent, onDeleteEvent, onRemoveTagFromEvent, onShowEventDetail, onLikeToggle, onAddSpotToKnot }: { userIdToDisplay: string; onNavigate: (page: string, id?: string | null) => void; onEditEvent: (event: EventType) => void; onDeleteEvent: (eventId: string, isPublic: boolean) => Promise<void>; onRemoveTagFromEvent: (eventId: string) => Promise<void>; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; onAddSpotToKnot: (spot: EventType) => void; }) => {
  const authContext = useAuth();
  const currentUser = authContext?.currentUser;
  const currentUserId = authContext?.userId;
  const currentUserProfile = authContext?.userProfile;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myEvents, setMyEvents] = useState<EventType[]>([]);
  const [myKnots, setMyKnots] = useState<KnotType[]>([]); // Nuovo stato per i Knot
  const [activeTab, setActiveTab] = useState('myEvents');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMyEvents, setLoadingMyEvents] = useState(true);
  const [loadingMyKnots, setLoadingMyKnots] = useState(true); // Nuovo stato per il caricamento dei Knot
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userIdToDisplay) {
      if (isMounted) {
        setLoadingProfile(false);
        setLoadingMyEvents(false);
        setLoadingMyKnots(false);
        setError("ID utente non fornito per la visualizzazione del profilo.");
      }
      return;
    }

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userIdToDisplay}/profile/data`);
    const unsubscribeProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (isMounted) {
        if (docSnap.exists()) {
          const fetchedProfile = { id: docSnap.id, ...(docSnap.data() as UserProfileData) };
          setProfile(fetchedProfile);
          if (currentUserProfile && currentUserProfile.following) {
            setIsFollowing(currentUserProfile.following.includes(userIdToDisplay));
          }
        } else {
          setProfile(null);
          setError("Profilo utente non trovato.");
        }
        setLoadingProfile(false);
      }
    }, (err) => {
      if (isMounted) {
        console.error("Error fetching user profile:", err);
        setError("Errore nel caricamento del profilo utente.");
        setLoadingProfile(false);
      }
    });

    const isOwnProfileBeingViewed = currentUserId === userIdToDisplay;

    // Fetch Events
    let eventsQuery;
    if (isOwnProfileBeingViewed) {
      eventsQuery = query(
        collection(db, `artifacts/${appId}/users/${userIdToDisplay}/events`),
        orderBy('createdAt', 'desc')
      );
    } else {
      eventsQuery = query(
        collection(db, `artifacts/${appId}/public/data/events`),
        where('creatorId', '==', userIdToDisplay),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      if (isMounted) {
        const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as EventData) }) as EventType);
        setMyEvents(fetchedEvents);
        setLoadingMyEvents(false);
      }
    }, (err) => {
      if (isMounted) {
        console.error("Error fetching user's events:", err);
        setError("Errore nel caricamento degli eventi dell'utente.");
        setLoadingMyEvents(false);
      }
    });

    // Fetch Knots
    let knotsQuery;
    if (isOwnProfileBeingViewed) {
      knotsQuery = query(
        collection(db, `artifacts/${appId}/users/${userIdToDisplay}/knots`),
        orderBy('createdAt', 'desc')
      );
    } else {
      knotsQuery = query(
        collection(db, `artifacts/${appId}/public/data/knots`),
        where('creatorId', '==', userIdToDisplay),
        where('status', '==', 'public'), // Solo Knot pubblici per altri utenti
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeKnots = onSnapshot(knotsQuery, (snapshot) => {
      if (isMounted) {
        const fetchedKnots = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as KnotData) }) as KnotType);
        setMyKnots(fetchedKnots);
        setLoadingMyKnots(false);
      }
    }, (err) => {
      if (isMounted) {
        console.error("Error fetching user's knots:", err);
        setError("Errore nel caricamento dei knot dell'utente.");
        setLoadingMyKnots(false);
      }
    });


    return () => {
      isMounted = false;
      unsubscribeProfile();
      unsubscribeEvents();
      unsubscribeKnots(); // Cleanup per i Knot
    };
  }, [userIdToDisplay, currentUser, currentUserId, currentUserProfile]);

  const handleFollowToggle = async () => {
    if (!currentUser || !currentUserId || userIdToDisplay === currentUserId) return;

    const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile/data`);
    const targetProfileRef = doc(db, `artifacts/${appId}/users/${userIdToDisplay}/profile/data`);

    try {
      const batch = writeBatch(db);
      if (isFollowing) {
        batch.update(userProfileRef, {
          following: arrayRemove(userIdToDisplay)
        });
        batch.update(targetProfileRef, {
          followers: arrayRemove(currentUserId)
        });
      } else {
        batch.update(userProfileRef, {
          following: arrayUnion(userIdToDisplay)
        });
        batch.update(targetProfileRef, {
          followers: arrayUnion(currentUserId)
        });
      }
      await batch.commit();
    } catch (error) {
      console.error("Error toggling follow/unfollow:", error);
      setError("Errore nel seguire/smettere di seguire.");
    }
  };

  const isOwnProfile = currentUserId === userIdToDisplay;

  if (loadingProfile || loadingMyEvents || loadingMyKnots) {
    return <LoadingSpinner message="Caricamento profilo..." />;
  }

  if (error) {
    return (
      <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4 text-center">
        <AlertMessage message={error} type="error" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4 text-center">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800"> Profilo Utente </h1>
        <p className="text-gray-600">Profilo utente non trovato.</p>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <UserAvatar
            imageUrl={profile.profileImage}
            username={profile.username}
            size="xl"
            className="mb-4 border-4 border-gray-500"
          />
          <h1 className="text-4xl font-extrabold text-gray-800 mb-2"> {profile.username} </h1>
          <p className="text-gray-600 text-lg">@{profile.profileTag} </p>
          <p className="text-gray-500 text-md"> {profile.email} </p>
          <div className="flex space-x-6 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold"> {profile.followers ? profile.followers.length : 0} </p>
              <p className="text-gray-600 text-sm"> Follower </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold"> {profile.following ? profile.following.length : 0} </p>
              <p className="text-gray-600 text-sm"> Seguiti </p>
            </div>
          </div>
          {!isOwnProfile && currentUser && (
            <FollowButton
              isFollowing={isFollowing}
              onToggle={handleFollowToggle}
            />
          )}
        </div>

        <div className="border-b border-gray-200 mb-6">
          <div className="flex justify-center space-x-6">
            <button
              onClick={() => setActiveTab('myEvents')}
              className={`py-3 px-6 text-lg font-semibold flex items-center space-x-2 ${activeTab === 'myEvents' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>Spot Creati ({myEvents.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('myKnots')}
              className={`py-3 px-6 text-lg font-semibold flex items-center space-x-2 ${activeTab === 'myKnots' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              <span>Knot ({myKnots.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-3 px-6 text-lg font-semibold flex items-center space-x-2 ${activeTab === 'calendar' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span>Calendario</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          {activeTab === 'myEvents' && (
            myEvents.length === 0 ? (
              <p className="text-center text-gray-600 col-span-full mt-10"> Nessuno Spot creato.</p>
            ) : (
              myEvents.map((event) => (
                <div key={event.id} className="w-full">
                  <EventCard
                    event={event}
                    currentUser={currentUser}
                    onFollowToggle={async () => { }}
                    followingUsers={[]}
                    onEdit={onEditEvent}
                    onDelete={onDeleteEvent}
                    isProfileView={true}
                    onLikeToggle={onLikeToggle}
                    onShowEventDetail={(clickedEvent) => onShowEventDetail(clickedEvent, myEvents, 'myEvents')}
                    onRemoveTag={onRemoveTagFromEvent}
                    onAddSpotToKnot={onAddSpotToKnot} // Passa la prop
                  />
                </div>
              ))
            )
          )}
          {activeTab === 'myKnots' && (
            myKnots.length === 0 ? (
              <p className="text-center text-gray-600 col-span-full mt-10"> Nessun Knot creato.</p>
            ) : (
              myKnots.map((knot) => (
                <div key={knot.id} className="w-full">
                  <KnotCard knot={knot} /> {/* Renderizza il nuovo KnotCard */}
                </div>
              ))
            )
          )}
          {activeTab === 'calendar' && (
            <SpotCalendar spots={myEvents} knots={myKnots} onShowSpotDetail={onShowEventDetail} />
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileDisplay;
