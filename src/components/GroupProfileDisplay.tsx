import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import UserAvatar from './UserAvatar';
import EventCard from './EventCard';
import KnotCard from './KnotCard';
import SpotCalendar from './SpotCalendar';
import { GroupType, EventType, KnotType, UserProfile, GroupProfileDisplayProps, NotificationData } from '../interfaces'; // Importa GroupProfileDisplayProps e NotificationData
import { Timestamp } from 'firebase/firestore'; // Importa Timestamp

const appId = "tagknot-app";

const GroupProfileDisplay: React.FC<GroupProfileDisplayProps> = ({
  groupIdToDisplay,
  onNavigate,
  onEditEvent,
  onDeleteEvent,
  onRemoveTagFromEvent,
  onShowEventDetail,
  onLikeToggle,
  onAddSpotToKnot,
  onEditKnot,
  onDeleteKnot,
  onShowKnotDetail,
}) => {
  const { currentUser, userId, userProfile, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<GroupType | null>(null);
  const [groupEvents, setGroupEvents] = useState<EventType[]>([]);
  const [groupKnots, setGroupKnots] = useState<KnotType[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [activeTab, setActiveTab] = useState('groupEvents'); // 'groupEvents', 'groupKnots', 'calendar', 'members'

  const isGroupMember = group?.members.includes(userId || '') || false;
  const isGroupCreator = group?.creatorId === userId;

  useEffect(() => {
    let isMounted = true;

    const fetchGroup = async () => {
      if (!groupIdToDisplay) return;
      setLoadingGroup(true);
      try {
        const groupRef = doc(db, `artifacts/${appId}/public/data/groups`, groupIdToDisplay);
        const groupSnap = await getDoc(groupRef);
        if (isMounted && groupSnap.exists()) {
          setGroup({ id: groupSnap.id, ...(groupSnap.data() as Omit<GroupType, 'id'>) });
        } else if (isMounted) {
          setGroup(null);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching group:", error);
      } finally {
        if (isMounted) setLoadingGroup(false);
      }
    };

    fetchGroup();

    return () => {
      isMounted = false;
    };
  }, [groupIdToDisplay]);

  useEffect(() => {
    let isMounted = true;
    if (!groupIdToDisplay || !group || !isGroupMember) { // Solo se l'utente è membro del gruppo
      setLoadingContent(false);
      setGroupEvents([]);
      setGroupKnots([]);
      return;
    }

    setLoadingContent(true);

    // Fetch group's events
    const groupEventsQuery = query(
      collection(db, `artifacts/${appId}/public/data/groups/${groupIdToDisplay}/events`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeGroupEvents = onSnapshot(groupEventsQuery, (snapshot) => {
      if (isMounted) {
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventType));
        setGroupEvents(events);
        setLoadingContent(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching group events:", error);
        setLoadingContent(false);
      }
    });

    // Fetch group's knots
    const groupKnotsQuery = query(
      collection(db, `artifacts/${appId}/public/data/groups/${groupIdToDisplay}/knots`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeGroupKnots = onSnapshot(groupKnotsQuery, (snapshot) => {
      if (isMounted) {
        const knots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnotType));
        setGroupKnots(knots);
        setLoadingContent(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching group knots:", error);
        setLoadingContent(false);
      }
    });


    return () => {
      isMounted = false;
      unsubscribeGroupEvents();
      unsubscribeGroupKnots();
    };
  }, [groupIdToDisplay, group, isGroupMember]); // Dipende anche da 'group' per assicurarsi che sia caricato e da isGroupMember

  // Funzione per mostrare i dettagli di un membro (naviga al profilo utente)
  const handleShowMemberProfile = (memberId: string) => {
    onNavigate('userProfile', memberId);
  };

  // Funzione per gestire la modifica del gruppo
  const handleEditGroup = () => {
    if (group) {
      onNavigate('editGroup', group.id); // Passa l'ID del gruppo al navigatore
    }
  };


  if (authLoading || loadingGroup) {
    return <LoadingSpinner message="Caricamento gruppo..." />;
  }

  if (!group) {
    return <div className="text-center py-8 text-gray-700">Gruppo non trovato o non hai i permessi per vederlo.</div>;
  }

  if (!isGroupMember) {
    return <div className="text-center py-8 text-gray-700">Non sei membro di questo gruppo.</div>;
  }

  const defaultGroupImage = group.name ?
    `https://placehold.co/400x400/E0E0E0/888?text=${encodeURIComponent(group.name.charAt(0).toUpperCase())}` :
    'https://placehold.co/400x400/E0E0E0/888?text=Gruppo';


  return (
    <div className="pt-20 pb-16 md:pt-24 md:pb-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 mt-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          <UserAvatar imageUrl={group.profileImage || defaultGroupImage} username={group.name} size="xl" className="border-4 border-gray-300 shadow-md" />
          <div className="text-center sm:text-left flex-grow">
            <h2 className="text-3xl font-extrabold text-gray-800">{group.name}</h2>
            {group.description && <p className="text-gray-600 text-lg mt-1">{group.description}</p>}
            <div className="flex justify-center sm:justify-start space-x-6 mt-3 text-gray-700">
              <div className="text-center">
                <span className="block font-bold text-xl">{groupEvents.length}</span>
                <span className="text-sm">Spot del Gruppo</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl">{groupKnots.length}</span>
                <span className="text-sm">Knot del Gruppo</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-xl">{group.members.length}</span>
                <span className="text-sm">Membri</span>
              </div>
            </div>
            {isGroupCreator && (
              <div className="mt-4 flex justify-center sm:justify-start space-x-3">
                <button
                  onClick={handleEditGroup}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                >
                  Modifica Gruppo
                </button>
                {/* Futura funzionalità: Invita Membri (già gestita nel modale di modifica) */}
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-gray-200 mt-8 mb-6">
          <nav className="-mb-px flex justify-center space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('groupEvents')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'groupEvents'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Spot del Gruppo ({groupEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('groupKnots')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'groupKnots'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Knot del Gruppo ({groupKnots.length})
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
            <button
              onClick={() => setActiveTab('members')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'members'
                  ? 'border-gray-800 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Membri ({group.members.length})
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingContent ? (
            <div className="col-span-full">
              <LoadingSpinner message={`Caricamento ${activeTab === 'groupEvents' ? 'spot' : activeTab === 'groupKnots' ? 'knot' : activeTab === 'members' ? 'membri' : 'calendario'} del gruppo...`} />
            </div>
          ) : (
            <>
              {activeTab === 'groupEvents' && (
                groupEvents.length > 0 ? (
                  groupEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      currentUser={currentUser}
                      onFollowToggle={async (creatorId, isFollowing) => { /* Non applicabile direttamente qui, ma deve essere async */ }}
                      followingUsers={userProfile?.following || []}
                      onEdit={() => onEditEvent(event)}
                      onDelete={() => onDeleteEvent(event.id, event.isPublic, event.creatorId, event.groupId)} // Passa groupId
                      isProfileView={true} // Per mostrare le opzioni di modifica/eliminazione se l'utente è il creatore
                      onLikeToggle={(eventId, isLiked) => onLikeToggle(eventId, isLiked, event.isPublic, event.creatorId)}
                      onShowEventDetail={(e, r, t, s) => onShowEventDetail(e, r, t, s)}
                      onRemoveTag={async (eventId) => { /* Non applicabile direttamente qui, ma deve essere async */ }}
                      onAddSpotToKnot={onAddSpotToKnot}
                    />
                  ))
                ) : (
                  <p className="col-span-full text-center text-gray-600">Nessun spot in questo gruppo.</p>
                )
              )}

              {activeTab === 'groupKnots' && (
                groupKnots.length > 0 ? (
                  groupKnots.map((knot) => (
                    <KnotCard
                      key={knot.id}
                      knot={knot}
                      onEditKnot={onEditKnot}
                      onDeleteKnot={(knotId) => onDeleteKnot(knotId, knot.status === 'public', knot.creatorId, knot.groupId)} // Passa groupId
                      onShowKnotDetail={onShowKnotDetail}
                    />
                  ))
                ) : (
                  <p className="col-span-full text-center text-gray-600">Nessun knot in questo gruppo.</p>
                )
              )}

              {activeTab === 'calendar' && (
                <div className="col-span-full">
                  <SpotCalendar spots={groupEvents} knots={groupKnots} onShowSpotDetail={onShowEventDetail} />
                </div>
              )}

              {activeTab === 'members' && (
                group.members.length > 0 ? (
                  <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {group.members.map((memberId) => (
                      <MemberCard key={memberId} memberId={memberId} onShowMemberProfile={handleShowMemberProfile} />
                    ))}
                  </div>
                ) : (
                  <p className="col-span-full text-center text-gray-600">Nessun membro in questo gruppo.</p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente ausiliario per visualizzare un singolo membro (per riutilizzabilità)
interface MemberCardProps {
  memberId: string;
  onShowMemberProfile: (memberId: string) => void;
}

const MemberCard: React.FC<MemberCardProps> = ({ memberId, onShowMemberProfile }) => {
  const [memberProfile, setMemberProfile] = useState<UserProfile | null>(null);
  const [loadingMember, setLoadingMember] = useState(true);
  const { userId: currentUserId } = useAuth(); // Per identificare il proprio profilo

  useEffect(() => {
    let isMounted = true;
    const fetchMemberProfile = async () => {
      if (!memberId) return;
      setLoadingMember(true);
      try {
        const profileRef = doc(db, `artifacts/${appId}/users/${memberId}/profile/data`);
        const profileSnap = await getDoc(profileRef);
        if (isMounted && profileSnap.exists()) {
          const data = profileSnap.data() as Omit<UserProfile, 'id'>;
          setMemberProfile({ id: profileSnap.id, ...data });
        } else if (isMounted) {
          setMemberProfile(null);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching member profile:", error);
      } finally {
        if (isMounted) setLoadingMember(false);
      }
    };
    fetchMemberProfile();
    return () => { isMounted = false; };
  }, [memberId]);

  if (loadingMember) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 flex items-center space-x-3">
        <div className="animate-pulse bg-gray-200 rounded-full h-10 w-10"></div>
        <div className="flex-grow">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!memberProfile) return null;

  return (
    <div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => onShowMemberProfile(memberId)}
    >
      <UserAvatar imageUrl={memberProfile.profileImage} username={memberProfile.username} size="md" />
      <div className="flex-grow">
        <p className="font-semibold text-gray-800">{memberProfile.username}</p>
        <p className="text-sm text-gray-500">@{memberProfile.profileTag} {memberId === currentUserId && '(Tu)'}</p>
      </div>
    </div>
  );
};

export default GroupProfileDisplay;
