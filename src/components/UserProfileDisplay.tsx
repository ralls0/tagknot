import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs, writeBatch, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore'; // Aggiunti gli import mancanti
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import EventCard from './EventCard';
import KnotCard from './KnotCard'; // Importa KnotCard
import SpotCalendar from './SpotCalendar'; // Importa SpotCalendar
import { EventType, UserProfile, KnotType, UserProfileDisplayProps, NotificationData } from '../interfaces'; // Importa UserProfileDisplayProps e NotificationData

const appId = "tagknot-app";

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
  onShowKnotDetail, // Aggiunta la prop onShowKnotDetail
}) => {
  const { currentUser, userId, userProfile, loading: authLoading } = useAuth();
  const [displayedUserProfile, setDisplayedUserProfile] = useState<UserProfile | null>(null);
  const [userEvents, setUserEvents] = useState<EventType[]>([]);
  const [userKnots, setUserKnots] = useState<KnotType[]>([]); // Nuovo stato per i knot dell'utente
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingKnots, setLoadingKnots] = useState(true); // Nuovo stato per il caricamento dei knot
  const [activeTab, setActiveTab] = useState('myEvents'); // 'myEvents', 'myKnots', 'calendar'

  const isOwnProfile = userIdToDisplay === userId;
  const isFollowing = userProfile?.following.includes(userIdToDisplay) || false;

  const noContentMessage = activeTab === 'myEvents'
    ? (isOwnProfile ? 'Non hai ancora creato alcuno Spot.' : 'Questo utente non ha ancora creato alcuno Spot.')
    : activeTab === 'myKnots'
      ? (isOwnProfile ? 'Non hai ancora creato alcun Knot.' : 'Questo utente non ha ancora creato alcun Knot.')
      : 'Nessun contenuto da mostrare nel calendario.';

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!userIdToDisplay) return;
      setLoadingProfile(true);
      try {
        const profileRef = doc(db, `artifacts/${appId}/users/${userIdToDisplay}/profile/data`);
        const profileSnap = await getDoc(profileRef);
        if (isMounted && profileSnap.exists()) {
          setDisplayedUserProfile({ id: profileSnap.id, ...(profileSnap.data() as Omit<UserProfile, 'id'>) });
        } else if (isMounted) {
          setDisplayedUserProfile(null);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching user profile:", error);
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
    let isMounted = true;
    if (!userIdToDisplay) {
      setLoadingEvents(false);
      setLoadingKnots(false);
      return;
    }

    setLoadingEvents(true);
    setLoadingKnots(true);

    // Fetch user's events (Spots)
    const eventsQuery = query(
      collection(db, `artifacts/${appId}/users/${userIdToDisplay}/events`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
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

    // Fetch user's knots
    const knotsQuery = query(
      collection(db, `artifacts/${appId}/users/${userIdToDisplay}/knots`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeKnots = onSnapshot(knotsQuery, (snapshot) => {
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

    return () => {
      isMounted = false;
      unsubscribeEvents();
      unsubscribeKnots();
    };
  }, [userIdToDisplay]);

  const handleFollowToggle = async (creatorId: string, currentlyFollowing: boolean) => {
    if (!currentUser || !userId || !userProfile) return;

    const batch = writeBatch(db);
    const currentUserProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    const targetUserProfileRef = doc(db, `artifacts/${appId}/users/${creatorId}/profile/data`);

    if (currentlyFollowing) {
      // Unfollow
      batch.update(currentUserProfileRef, {
        following: arrayRemove(creatorId)
      });
      batch.update(targetUserProfileRef, {
        followers: arrayRemove(userId)
      });
    } else {
      // Follow
      batch.update(currentUserProfileRef, {
        following: arrayUnion(creatorId)
      });
      batch.update(targetUserProfileRef, {
        followers: arrayUnion(userId)
      });

      // Send notification to the followed user
      const notificationData: NotificationData = {
        type: 'follow',
        fromUserId: userId,
        fromUsername: userProfile.username,
        message: `${userProfile.username} ha iniziato a seguirti!`,
        createdAt: serverTimestamp() as Timestamp,
        read: false,
        imageUrl: userProfile.profileImage || '',
      };
      await addDoc(collection(db, `artifacts/${appId}/users/${creatorId}/notifications`), notificationData);
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("Error toggling follow status:", error);
    }
  };

  if (authLoading || loadingProfile) {
    return <LoadingSpinner message="Caricamento profilo..." />;
  }

  if (!displayedUserProfile) {
    return <div className="text-center py-8 text-gray-700">Profilo utente non trovato.</div>;
  }

  const defaultProfileImage = displayedUserProfile.username ?
    `https://placehold.co/400x400/E0E0E0/888?text=${encodeURIComponent(displayedUserProfile.username.charAt(0).toUpperCase())}` :
    'https://placehold.co/400x400/E0E0E0/888?text=Utente';

  const displayedEvents = userEvents.filter(event => event.isPublic || event.creatorId === userId);
  const displayedKnots = userKnots.filter(knot => knot.status === 'public' || knot.creatorId === userId);


  return (
    <div className="pt-20 pb-16 md:pt-24 md:pb-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 mt-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          <UserAvatar imageUrl={displayedUserProfile.profileImage || defaultProfileImage} username={displayedUserProfile.username} size="xl" className="border-4 border-gray-300 shadow-md" />
          <div className="text-center sm:text-left flex-grow">
            <h2 className="text-3xl font-extrabold text-gray-800">{displayedUserProfile.username}</h2>
            <p className="text-gray-600 text-lg mt-1">@{displayedUserProfile.profileTag}</p>
            <div className="flex justify-center sm:justify-start space-x-6 mt-3 text-gray-700">
              <div className="text-center">
                <span className="block font-bold text-xl">{displayedUserProfile.followers.length}</span>
                <span className="text-sm">Follower</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl">{displayedUserProfile.following.length}</span>
                <span className="text-sm">Following</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl">{userEvents.length}</span>
                <span className="text-sm">Spot</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl">{userKnots.length}</span>
                <span className="text-sm">Knot</span>
              </div>
            </div>
            {!isOwnProfile && currentUser && (
              <div className="mt-4 flex justify-center sm:justify-start">
                <FollowButton
                  isFollowing={isFollowing}
                  onToggle={() => handleFollowToggle(userIdToDisplay, isFollowing)}
                  disabled={!userId}
                />
              </div>
            )}
            {isOwnProfile && (
              <div className="mt-4 flex justify-center sm:justify-start">
                <button
                  onClick={() => onNavigate('settings')}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                >
                  Modifica Profilo
                </button>
              </div>
            )}
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
              Spot ({displayedEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('myKnots')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'myKnots'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Knot ({displayedKnots.length})
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
          {(loadingEvents || loadingKnots) ? (
            <div className="col-span-full">
              <LoadingSpinner message={`Caricamento ${activeTab === 'myEvents' ? 'spot' : activeTab === 'myKnots' ? 'knot' : 'calendario'}...`} />
            </div>
          ) : (
            <>
              {activeTab === 'myKnots' ? (
                displayedKnots.length > 0 ? (
                  displayedKnots.map((knot) => (
                    <KnotCard
                      key={knot.id}
                      knot={knot}
                      onEditKnot={onEditKnot}
                      onDeleteKnot={(knotId) => onDeleteKnot(knotId, knot.status === 'public', knot.creatorId, knot.groupId)}
                      onShowKnotDetail={onShowKnotDetail}
                      onLikeToggle={onLikeToggle}
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
                      onDelete={() => onDeleteEvent(event.id, event.isPublic, event.creatorId, event.groupId)}
                      isProfileView={true}
                      onLikeToggle={(eventId, isLiked) => onLikeToggle(eventId, isLiked, event.isPublic, event.creatorId)}
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
