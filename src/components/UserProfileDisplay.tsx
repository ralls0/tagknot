import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import EventCard from './EventCard';
import KnotCard from './KnotCard'; // Importa KnotCard
import SpotCalendar from './SpotCalendar'; // Importa SpotCalendar
import { EventType, UserProfile, KnotType } from '../interfaces';

const appId = "tagknot-app";

interface UserProfileDisplayProps {
  userIdToDisplay: string;
  onNavigate: (page: string, id?: string) => void;
  onEditEvent: (event: EventType) => void;
  onDeleteEvent: (eventId: string, isPublic: boolean) => Promise<void>;
  onRemoveTagFromEvent: (eventId: string) => Promise<void>;
  onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void;
  onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>;
  onAddSpotToKnot: (spot: EventType) => void;
  onEditKnot: (knot: KnotType) => void; // Nuova prop
  onDeleteKnot: (knotId: string, isPublic: boolean, creatorId: string) => Promise<void>; // Nuova prop
}

const UserProfileDisplay: React.FC<UserProfileDisplayProps> = ({
  userIdToDisplay,
  onNavigate,
  onEditEvent,
  onDeleteEvent,
  onRemoveTagFromEvent,
  onShowEventDetail,
  onLikeToggle,
  onAddSpotToKnot,
  onEditKnot,
  onDeleteKnot,
}) => {
  const { currentUser, userId, userProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userEvents, setUserEvents] = useState<EventType[]>([]);
  const [userKnots, setUserKnots] = useState<KnotType[]>([]); // Stato per i Knot dell'utente
  // const [taggedEvents, setTaggedEvents] = useState<EventType[]>([]); // Rimossa la gestione degli spot taggati
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  // const [loadingTaggedEvents, setLoadingTaggedEvents] = useState(true); // Rimossa la gestione degli spot taggati
  const [loadingKnots, setLoadingKnots] = useState(true); // Stato di caricamento per i Knot
  const [activeTab, setActiveTab] = useState('myEvents'); // 'myEvents', 'calendar', 'knots'

  const isOwnProfile = userIdToDisplay === userId;
  const isFollowing = isOwnProfile ? false : (userProfile?.following || []).includes(userIdToDisplay);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!userIdToDisplay) return;
      setLoadingProfile(true);
      try {
        const profileRef = doc(db, `artifacts/${appId}/users/${userIdToDisplay}/profile/data`);
        const profileSnap = await getDoc(profileRef);
        if (isMounted && profileSnap.exists()) {
          // Corretto: non sovrascrivere 'id' se già presente nei dati
          setProfile({ id: profileSnap.id, ...(profileSnap.data() as Omit<UserProfile, 'id'>) });
        } else if (isMounted) {
          setProfile(null);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching profile:", error);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [userIdToDisplay]);

  useEffect(() => {
    let isMounted = true; // Dichiarazione di isMounted all'interno di useEffect
    if (!userIdToDisplay) return;

    setLoadingEvents(true);
    // setLoadingTaggedEvents(true); // Rimossa la gestione degli spot taggati
    setLoadingKnots(true); // Imposta loading per i Knot

    // Fetch user's own events (private)
    const ownEventsQuery = query(
      collection(db, `artifacts/${appId}/users/${userIdToDisplay}/events`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOwnEvents = onSnapshot(ownEventsQuery, (snapshot) => {
      if (isMounted) {
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventType));
        setUserEvents(events);
        setLoadingEvents(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching user events:", error);
        setLoadingEvents(false);
      }
    });

    // Fetch user's knots (private)
    const userKnotsQuery = query(
      collection(db, `artifacts/${appId}/users/${userIdToDisplay}/knots`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeUserKnots = onSnapshot(userKnotsQuery, (snapshot) => {
      if (isMounted) {
        const knots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnotType));
        setUserKnots(knots);
        setLoadingKnots(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching user knots:", error);
        setLoadingKnots(false);
      }
    });


    // Rimossa la logica per gli spot taggati
    // let unsubscribeTaggedEvents: () => void = () => {};
    // if (profile?.profileTag) {
    //   const taggedEventsQuery = query(
    //     collection(db, `artifacts/${appId}/public/data/events`),
    //     where('taggedUsers', 'array-contains', profile.profileTag),
    //     orderBy('createdAt', 'desc')
    //   );
    //   unsubscribeTaggedEvents = onSnapshot(taggedEventsQuery, (snapshot) => {
    //     if (isMounted) {
    //       const events = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as EventType) }));
    //       setTaggedEvents(events);
    //       setLoadingTaggedEvents(false);
    //     }
    //   }, (error) => {
    //     if (isMounted) {
    //       console.error("Error fetching tagged events:", error);
    //       setLoadingTaggedEvents(false);
    //     }
    //   });
    // } else {
    //   if (isMounted) setLoadingTaggedEvents(false); // No profile tag, no tagged events to fetch
    // }


    return () => {
      isMounted = false;
      unsubscribeOwnEvents();
      unsubscribeUserKnots();
      // unsubscribeTaggedEvents(); // Rimossa la cleanup per gli spot taggati
    };
  }, [userIdToDisplay, profile?.profileTag]); // Dipendenza da profile.profileTag per le query taggate

  const handleFollowToggle = async () => {
    if (!currentUser || !userId || !userProfile || !profile) return;

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    const targetProfileRef = doc(db, `artifacts/${appId}/users/${profile.id}/profile/data`);

    try {
      if (isFollowing) {
        // Unfollow
        await updateDoc(userProfileRef, { following: arrayRemove(profile.id) });
        await updateDoc(targetProfileRef, { followers: arrayRemove(userId) });
      } else {
        // Follow
        await updateDoc(userProfileRef, { following: arrayUnion(profile.id) });
        await updateDoc(targetProfileRef, { followers: arrayUnion(userId) });
      }
      // Aggiorna lo stato locale del profilo per riflettere il cambiamento immediatamente
      // isMounted è già nel closure di useEffect, quindi è accessibile
      setProfile(prevProfile => {
        if (!prevProfile) return null;
        const newFollowers = isFollowing
          ? prevProfile.followers.filter(id => id !== userId)
          : [...prevProfile.followers, userId];
        return { ...prevProfile, followers: newFollowers };
      });

    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  if (authLoading || loadingProfile) {
    return <LoadingSpinner message="Caricamento profilo..." />;
  }

  if (!profile) {
    return <div className="text-center py-8 text-gray-700">Profilo non trovato.</div>;
  }

  // Modificato per non considerare taggedEvents
  const displayedEvents = userEvents;
  const loadingContent = activeTab === 'myEvents' ? loadingEvents : activeTab === 'knots' ? loadingKnots : false; // Aggiunto false per il calendario, che usa i propri dati
  const noContentMessage = activeTab === 'myEvents' ? 'Nessun spot creato.' : activeTab === 'knots' ? 'Nessun knot creato.' : 'Nessun evento nel calendario.';


  return (
    <div className="pt-20 pb-16 md:pt-24 md:pb-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 mt-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          <UserAvatar imageUrl={profile.profileImage} username={profile.username} size="lg" />
          <div className="text-center sm:text-left flex-grow">
            <h2 className="text-3xl font-extrabold text-gray-800"> {profile.username} </h2>
            <p className="text-gray-600 text-lg">@{profile.profileTag} </p>
            <div className="flex justify-center sm:justify-start space-x-6 mt-3 text-gray-700">
              <div className="text-center">
                <span className="block font-bold text-xl"> {userEvents.length} </span>
                <span className="text-sm">Spot</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl"> {profile.followers.length} </span>
                <span className="text-sm">Follower</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl"> {profile.following.length} </span>
                <span className="text-sm">Following</span>
              </div>
            </div>
            {
              !isOwnProfile && currentUser && (
                <div className="mt-4">
                  <FollowButton
                    isFollowing={isFollowing}
                    onToggle={handleFollowToggle}
                  />
                </div>
              )
            }
            {
              isOwnProfile && (
                <div className="mt-4 flex justify-center sm:justify-start space-x-3">
                  <button
                    onClick={() => onNavigate('settings')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                  >
                    Modifica Profilo
                  </button>
                  <button
                    onClick={() => onNavigate('createEvent')}
                    className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                  >
                    Crea Spot/Knot
                  </button>
                </div>
              )
            }
          </div>
        </div>

        <div className="border-b border-gray-200 mt-8 mb-6">
          <nav className="-mb-px flex justify-center space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('myEvents')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'myEvents'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              I Miei Spot ({userEvents.length})
            </button>
            {/* Rimossa la tab per gli spot taggati */}
            {/*
            {
              isOwnProfile && (
                <button
                  onClick={() => setActiveTab('taggedEvents')}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'taggedEvents'
                      ? 'border-gray-800 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Spot Taggati ({taggedEvents.length})
                </button>
              )
            }
            */}
            <button
              onClick={() => setActiveTab('knots')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'knots'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              I Miei Knot ({userKnots.length})
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'calendar'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendario
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingContent ? (
            <div className="col-span-full">
              <LoadingSpinner message={`Caricamento ${activeTab === 'myEvents' ? 'spot' : activeTab === 'knots' ? 'knot' : 'calendario'}...`} />
            </div>
          ) : (
            <>
              {activeTab === 'knots' ? (
                userKnots.length > 0 ? (
                  userKnots.map((knot) => (
                    <KnotCard
                      key={knot.id}
                      knot={knot}
                      onEditKnot={onEditKnot}
                      onDeleteKnot={(knotId) => onDeleteKnot(knotId, knot.status === 'public', knot.creatorId)} // Passa isPublic e creatorId
                    />
                  ))
                ) : (
                  <p className="col-span-full text-center text-gray-600"> {noContentMessage} </p>
                )
              ) : activeTab === 'calendar' ? (
                // Passa tutti gli eventi dell'utente e i knot al calendario
                <div className="col-span-full">
                  <SpotCalendar spots={userEvents} knots={userKnots} onShowSpotDetail={onShowEventDetail} />
                </div>
              ) : ( // activeTab === 'myEvents'
                displayedEvents.length > 0 ? (
                  displayedEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      currentUser={currentUser}
                      onFollowToggle={handleFollowToggle}
                      followingUsers={userProfile?.following || []}
                      onEdit={() => onEditEvent(event)}
                      onDelete={() => onDeleteEvent(event.id, event.isPublic)}
                      isProfileView={true}
                      onLikeToggle={onLikeToggle}
                      onShowEventDetail={(e, r, t, s) => onShowEventDetail(e, r, t, s)}
                      onRemoveTag={(eId) => onRemoveTagFromEvent(eId)}
                      onAddSpotToKnot={onAddSpotToKnot}
                    />
                  ))
                ) : (
                  <p className="col-span-full text-center text-gray-600"> {noContentMessage} </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileDisplay;
