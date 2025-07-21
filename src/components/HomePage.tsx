import React, { useState, useEffect } from 'react';
import { doc, collection, query, where, orderBy, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import EventCard from './EventCard';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { EventType, UserProfileData } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const HomePage = ({ onShowEventDetail, onLikeToggle }: { onShowEventDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>; }) => {
  const authContext = useAuth();
  const currentUser = authContext?.currentUser;
  const userId = authContext?.userId;
  const [events, setEvents] = useState<EventType[]>([]);
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      if (isMounted) {
        setLoadingEvents(false);
        setError("Devi essere loggato per vedere il feed.");
      }
      return;
    }

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    const unsubscribeProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (isMounted) {
        if (docSnap.exists()) {
          setFollowingUsers((docSnap.data() as UserProfileData).following || []);
        } else {
          setFollowingUsers([]);
        }
      }
    }, (err) => {
      if (isMounted) {
        console.error("Error fetching following users:", err);
        setError("Errore nel caricamento degli utenti seguiti.");
      }
    });

    const publicEventsQuery = query(
      collection(db, `artifacts/${appId}/public/data/events`),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribePublicEvents = onSnapshot(publicEventsQuery, (snapshot) => {
      if (!isMounted) return;

      const fetchedPublicEvents = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as EventData) }));

      const filteredEvents = fetchedPublicEvents.filter(event =>
        followingUsers.includes(event.creatorId) || event.creatorId === userId
      );

      if (filteredEvents.length === 0 && fetchedPublicEvents.length > 0) {
        setEvents(fetchedPublicEvents);
      } else {
        setEvents(filteredEvents);
      }
      setLoadingEvents(false);
      setError(null);
    }, (err) => {
      if (isMounted) {
        console.error("Error fetching events:", err);
        setError("Errore nel recupero degli eventi.");
        setLoadingEvents(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeProfile();
      unsubscribePublicEvents();
    };
  }, [userId, followingUsers]);

  const handleFollowToggle = async (creatorId: string, isFollowing: boolean) => {
    if (!currentUser || !userId || creatorId === userId) return;

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
    const creatorProfileRef = doc(db, `artifacts/${appId}/users/${creatorId}/profile/data`);

    try {
      if (isFollowing) {
        await updateDoc(userProfileRef, {
          following: arrayRemove(creatorId)
        });
        await updateDoc(creatorProfileRef, {
          followers: arrayRemove(userId)
        });
      } else {
        await updateDoc(userProfileRef, {
          following: arrayUnion(creatorId)
        });
        await updateDoc(creatorProfileRef, {
          followers: arrayUnion(userId)
        });
      }
    } catch (error) {
      console.error("Error toggling follow/unfollow:", error);
      setError("Errore nel seguire/smettere di seguire.");
    }
  };

  if (loadingEvents) {
    return <LoadingSpinner message="Caricamento eventi..." />;
  }

  if (error) {
    return (
      <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4 text-center">
        <AlertMessage message={error} type="error" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800">
      <div className="flex flex-col items-center gap-6 p-4 max-w-xl mx-auto">
        {
          events.length === 0 ? (
            <p className="text-center text-gray-600 mt-10">Nessun evento disponibile nel tuo feed. Inizia a seguire qualcuno o crea il tuo primo evento!</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="w-full">
                <EventCard
                  event={event}
                  currentUser={currentUser}
                  onFollowToggle={handleFollowToggle}
                  followingUsers={followingUsers}
                  onLikeToggle={onLikeToggle}
                  onShowEventDetail={onShowEventDetail}
                  onEdit={async () => { }}
                  onDelete={async () => { }}
                  onRemoveTag={async () => { }}
                />
              </div>
            ))
          )}
      </div>
    </div>
  );
};

export default HomePage;
