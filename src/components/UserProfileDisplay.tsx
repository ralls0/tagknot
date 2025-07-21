import React, { useState, useEffect } from 'react';
import { doc, collection, query, where, orderBy, onSnapshot, updateDoc, arrayRemove, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import EventCard from './EventCard';
import { EventType, UserProfileData, EventData, UserProfile } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const UserProfileDisplay = ({ userIdToDisplay, onNavigate, onEditEvent, onDeleteEvent, onRemoveTagFromEvent, onShowEventDetail, onLikeToggle }: { userIdToDisplay: string; onNavigate: (page: string, id?: string | null) => void; onEditEvent: (event: EventType) => void; onDeleteEvent: (eventId: string, isPublic: boolean) => Promise<void>; onRemoveTagFromEvent: (eventId: string) => Promise<void>; onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; }) => {
  const authContext = useAuth();
  const currentUser = authContext?.currentUser;
  const currentUserId = authContext?.userId;
  const currentUserProfile = authContext?.userProfile;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myEvents, setMyEvents] = useState<EventType[]>([]);
  // const [taggedEvents, setTaggedEvents] = useState<EventType[]>([]); // Commentato come richiesto
  const [activeTab, setActiveTab] = useState('myEvents'); // Mantiene solo 'myEvents'
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMyEvents, setLoadingMyEvents] = useState(true);
  // const [loadingTaggedEvents, setLoadingTaggedEvents] = useState(true); // Commentato come richiesto
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userIdToDisplay) {
      if (isMounted) {
        setLoadingProfile(false);
        setLoadingMyEvents(false);
        // setLoadingTaggedEvents(false); // Commentato
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
          // Logica per gli eventi taggati commentata come richiesto
          /*
          const profileTagForTaggedEvents = fetchedProfile.profileTag || (fetchedProfile.email ? fetchedProfile.email.split('@')[0] : '');
          if (profileTagForTaggedEvents) {
            const taggedEventsQuery = query(
              collection(db, `artifacts/${appId}/public/data/events`),
              where('taggedUsers', 'array-contains', profileTagForTaggedEvents),
              orderBy('createdAt', 'desc')
            );
            const unsubscribeTaggedEvents = onSnapshot(taggedEventsQuery, (snapshot) => {
              if (isMounted) {
                const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as EventData) }));
                setTaggedEvents(fetchedEvents);
                setLoadingTaggedEvents(false);
              }
            }, (err) => {
              if (isMounted) {
                console.error("Error fetching tagged events:", err);
                setError("Errore nel caricamento degli eventi taggati.");
                setLoadingTaggedEvents(false);
              }
            });
            return () => {
              unsubscribeTaggedEvents();
            };
          } else {
            if (isMounted) {
              setLoadingTaggedEvents(false);
            }
          }
          */
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

    let myEventsQuery;
    if (isOwnProfileBeingViewed) {
      myEventsQuery = query(
        collection(db, `artifacts/${appId}/users/${userIdToDisplay}/events`),
        orderBy('createdAt', 'desc')
      );
    } else {
      myEventsQuery = query(
        collection(db, `artifacts/${appId}/public/data/events`),
        where('creatorId', '==', userIdToDisplay),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeMyEvents = onSnapshot(myEventsQuery, (snapshot) => {
      if (isMounted) {
        const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as EventData) }));
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

    return () => {
      isMounted = false;
      unsubscribeProfile();
      unsubscribeMyEvents();
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

  if (loadingProfile || loadingMyEvents) {
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
              className={`py-3 px-6 text-lg font-semibold ${activeTab === 'myEvents' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Eventi Creati ({myEvents.length})
            </button>
            {/* Bottone "Eventi Taggati" rimosso come richiesto */}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          {activeTab === 'myEvents' && (
            myEvents.length === 0 ? (
              <p className="text-center text-gray-600 col-span-full mt-10"> Nessun evento creato.</p>
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
                    onShowEventDetail={onShowEventDetail}
                    onRemoveTag={async () => { }}
                  />
                </div>
              ))
            )
          )}
          {/* Sezione per gli eventi taggati rimossa come richiesto */}
        </div>
      </div>
    </div>
  );
};

export default UserProfileDisplay;
