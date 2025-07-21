import React, { useState, useEffect } from 'react';
import { collection, collectionGroup, query, where, getDocs, doc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import AlertMessage from './AlertMessage';
import UserAvatar from './UserAvatar';
import { EventType, UserProfile, UserProfileData, NotificationData } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const ShareEventModal = ({ event, onClose, onShareSuccess }: { event: EventType; onClose: () => void; onShareSuccess: () => void; }) => {
  const authContext = useAuth();
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        try {
          const usersQueryByUsername = query(
            collectionGroup(db, 'profile'),
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff')
          );

          const usernameSnapshot = await getDocs(usersQueryByUsername);

          if (isMounted) {
            const uniqueUsers = new Map<string, UserProfile>();
            usernameSnapshot.docs.forEach(doc => uniqueUsers.set(doc.id, { id: doc.id, ...(doc.data() as UserProfileData) }));

            setSearchResults(Array.from(uniqueUsers.values()).filter(user => user.id !== userId));
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error searching users for sharing:", error);
            setSearchResults([]);
          }
        }
      } else {
        if (isMounted) {
          setSearchResults([]);
        }
      }
    }, 300);
    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchTerm, userId]);

  const handleToggleUserSelection = (user: UserProfile) => {
    setSelectedUsers(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      setMessage('Seleziona almeno un utente per condividere.');
      setMessageType('error');
      return;
    }
    setIsSharing(true);
    setMessage('');
    setMessageType('');

    try {
      if (!userProfile) {
        throw new Error("User profile not loaded.");
      }
      const batch = writeBatch(db);
      for (const user of selectedUsers) {
        const notificationData: NotificationData = {
          type: 'share',
          fromUserId: userId || '',
          fromUsername: userProfile.username,
          eventId: event.id,
          eventTag: event.tag,
          message: `${userProfile.username} ha condiviso un evento con te: #${event.tag}`,
          createdAt: serverTimestamp() as any, // Firebase Timestamp type
          read: false,
          imageUrl: event.coverImage || '',
        };
        const notificationRef = doc(collection(db, `artifacts/${appId}/users/${user.id}/notifications`));
        batch.set(notificationRef, notificationData);
      }
      await batch.commit();
      setMessage('Evento condiviso con successo!');
      setMessageType('success');
      onShareSuccess();
    } catch (error) {
      console.error("Error sharing event:", error);
      setMessage('Errore durante la condivisione dell\'evento.');
      setMessageType('error');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4"> Condividi Evento: {event.tag} </h2>

        <AlertMessage message={message} type={messageType} />

        <div className="mb-4">
          <input
            type="text"
            placeholder="Cerca utenti per nome o tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        </div>

        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 mb-4">
          {
            searchResults.length === 0 && searchTerm.length > 1 && !isSharing ? (
              <p className="text-gray-500 text-center py-4"> Nessun utente trovato.</p>
            ) : (
              searchResults.map(user => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${selectedUsers.some(u => u.id === user.id) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                  onClick={() => handleToggleUserSelection(user)}
                >
                  <div className="flex items-center space-x-3">
                    <UserAvatar
                      imageUrl={user.profileImage}
                      username={user.username}
                      size="sm"
                    />
                    <span>{user.username} <span className="text-gray-500 text-sm"> @{user.profileTag}</span></span>
                  </div>
                  {
                    selectedUsers.some(u => u.id === user.id) && (
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"> </path></svg>
                    )
                  }
                </div>
              ))
            )}
        </div>

        {
          selectedUsers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-md font-semibold text-gray-700 mb-2"> Selezionati: </h3>
              <div className="flex flex-wrap gap-2">
                {
                  selectedUsers.map(user => (
                    <span key={user.id} className="bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full flex items-center">
                      {user.username}
                      <button onClick={() => handleToggleUserSelection(user)} className="ml-2 text-gray-600 hover:text-gray-900">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
                      </button>
                    </span>
                  ))
                }
              </div>
            </div>
          )}

        <button
          onClick={handleShare}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg"
          disabled={isSharing}
        >
          {isSharing ? 'Condivisione...' : 'Condividi'}
        </button>
      </div>
    </div>
  );
};

export default ShareEventModal;
