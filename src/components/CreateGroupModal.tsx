import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, serverTimestamp, query, collectionGroup, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore'; // Aggiunto collectionGroup
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import UserAvatar from './UserAvatar';
import { GroupData, CreateGroupModalProps, UserProfile, NotificationData } from '../interfaces';
import { Timestamp } from 'firebase/firestore'; // Importa Timestamp

const appId = "tagknot-app";

// Funzione per ridimensionare e convertire un'immagine in Base64 (riutilizzata da CreateContentPage)
const resizeAndConvertToBase64 = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error("Could not get 2D context for canvas"));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onCreateSuccess }) => {
  const { userId, userProfile } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImageFile, setGroupImageFile] = useState<File | null>(null);
  const [groupImageUrlInput, setGroupImageUrlInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // Aggiungi l'utente corrente come membro predefinito
  useEffect(() => {
    if (userProfile && userId && !selectedMembers.some(member => member.id === userId)) {
      setSelectedMembers(prev => [...prev, { ...userProfile, id: userId }]);
    }
  }, [userProfile, userId, selectedMembers]);


  // Gestione ricerca utenti (simile a ShareEventModal)
  useEffect(() => {
    let isMounted = true;
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        try {
          // Cerca per username
          const usersQueryByUsername = query(
            collectionGroup(db, 'profile'),
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff')
          );
          const usernameSnapshot = await getDocs(usersQueryByUsername);
          const usersByUsername = usernameSnapshot.docs.map(doc => {
            // Correzione qui: cast a Omit<UserProfile, 'id'> per evitare la duplicazione dell'id
            const data = doc.data() as Omit<UserProfile, 'id'>;
            return { id: doc.ref.parent.parent?.id || doc.id, ...data };
          });

          // Cerca per profileTag
          const usersQueryByProfileTag = query(
            collectionGroup(db, 'profile'),
            where('profileTag', '>=', searchTerm),
            where('profileTag', '<=', searchTerm + '\uf8ff')
          );
          const profileTagSnapshot = await getDocs(usersQueryByProfileTag);
          const usersByProfileTag = profileTagSnapshot.docs.map(doc => {
            // Correzione qui: cast a Omit<UserProfile, 'id'> per evitare la duplicazione dell'id
            const data = doc.data() as Omit<UserProfile, 'id'>;
            return { id: doc.ref.parent.parent?.id || doc.id, ...data };
          });

          // Combina e rimuovi duplicati
          const combinedResults = Array.from(new Set([...usersByUsername, ...usersByProfileTag].map(user => user.id)))
            .map(id => [...usersByUsername, ...usersByProfileTag].find(user => user.id === id))
            .filter((user): user is UserProfile => user !== undefined); // Filtra i potenziali undefined

          if (isMounted) {
            // Filtra se l'utente è già un membro selezionato o l'utente corrente
            const filteredResults = combinedResults.filter(user =>
              user.id !== userId && !selectedMembers.some(member => member.id === user.id)
            );
            setSearchResults(filteredResults);
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error searching users:", error);
            setMessage('Errore durante la ricerca utenti.');
            setMessageType('error');
          }
        }
      } else {
        if (isMounted) setSearchResults([]);
      }
    }, 300); // Debounce per la ricerca

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchTerm, userId, selectedMembers]);

  const handleToggleUserSelection = (user: UserProfile) => {
    setSelectedMembers(prev =>
      prev.some(member => member.id === user.id)
        ? prev.filter(member => member.id !== user.id)
        : [...prev, user]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGroupImageFile(e.target.files[0]);
      setGroupImageUrlInput('');
    }
  };

  const handleImageUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGroupImageUrlInput(e.target.value);
    setGroupImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !userProfile) {
      setMessage('Utente non autenticato. Impossibile creare il gruppo.');
      setMessageType('error');
      return;
    }
    if (!groupName.trim()) {
      setMessage('Il nome del gruppo è obbligatorio.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');
    let finalGroupImage = '';

    try {
      if (groupImageUrlInput) {
        finalGroupImage = groupImageUrlInput;
      } else if (groupImageFile) {
        setIsUploadingImage(true);
        finalGroupImage = await resizeAndConvertToBase64(groupImageFile, 400, 400); // Immagine profilo più piccola
        setIsUploadingImage(false);
      }

      // Crea un ID per il documento prima di salvarlo
      const newGroupRef = doc(collection(db, `artifacts/${appId}/public/data/groups`));
      const groupId = newGroupRef.id;

      const newGroupData: GroupData = {
        type: 'group',
        name: groupName,
        description: groupDescription,
        profileImage: finalGroupImage,
        members: selectedMembers.map(member => member.id),
        creatorId: userId,
        createdAt: serverTimestamp() as Timestamp,
      };

      await setDoc(newGroupRef, newGroupData);

      // Invia notifiche agli utenti invitati (non al creatore)
      const invitedMembers = selectedMembers.filter(member => member.id !== userId);
      for (const member of invitedMembers) {
        const notificationData: NotificationData = {
          type: 'group_invite',
          fromUserId: userId,
          fromUsername: userProfile.username,
          groupId: groupId,
          groupName: groupName,
          message: `${userProfile.username} ti ha invitato a unirti al gruppo "${groupName}".`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: finalGroupImage || '',
        };
        await setDoc(doc(collection(db, `artifacts/${appId}/users/${member.id}/notifications`)), notificationData);
      }

      setMessage('Gruppo creato con successo!');
      setMessageType('success');
      onCreateSuccess(groupId); // Passa l'ID del gruppo creato
    } catch (error) {
      console.error("Error creating group:", error);
      setMessage('Errore durante la creazione del gruppo. Riprova.');
      setMessageType('error');
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
        </button>

        <div className="p-6 flex-grow overflow-y-auto">
          <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Crea Nuovo Gruppo</h3>
          <AlertMessage message={message} type={messageType} />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">Nome Gruppo <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="groupName"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="groupDescription" className="block text-sm font-medium text-gray-700 mb-1">Descrizione Gruppo (Opzionale)</label>
              <textarea
                id="groupDescription"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
              ></textarea>
            </div>
            <div>
              <label htmlFor="groupImageFile" className="block text-sm font-medium text-gray-700 mb-1">Immagine Gruppo (Carica File)</label>
              <input
                type="file"
                id="groupImageFile"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                disabled={!!groupImageUrlInput}
              />
              <p className="text-center text-gray-500 my-2">O</p>
              <label htmlFor="groupImageUrl" className="block text-sm font-medium text-gray-700 mb-1">Immagine Gruppo (da URL)</label>
              <input
                type="url"
                id="groupImageUrl"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={groupImageUrlInput}
                onChange={handleImageUrlInputChange}
                placeholder="Es. https://example.com/group_logo.jpg"
                disabled={!!groupImageFile}
              />
              {isUploadingImage && (
                <div className="flex items-center justify-center mt-2 text-gray-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                  Caricamento immagine...
                </div>
              )}
            </div>

            {/* Aggiungi Membri */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Aggiungi Membri</h4>
              <input
                type="text"
                placeholder="Cerca utenti per username o tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 mb-3"
              />
              {searchResults.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto mb-4">
                  {searchResults.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleToggleUserSelection(user)}
                    >
                      <div className="flex items-center space-x-3">
                        <UserAvatar imageUrl={user.profileImage} username={user.username} size="sm" />
                        <span className="font-medium text-gray-800">{user.username}</span>
                        <span className="text-sm text-gray-500">@{user.profileTag}</span>
                      </div>
                      {selectedMembers.some(member => member.id === user.id) ? (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedMembers.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-md font-semibold text-gray-700 mb-2">Membri Selezionati:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map(member => (
                      <span key={member.id} className="bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full flex items-center">
                        {member.username}
                        {member.id !== userId && ( // Non permettere di rimuovere se stesso
                          <button onClick={() => handleToggleUserSelection(member)} className="ml-2 text-gray-600 hover:text-gray-900">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isSaving}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isSaving || isUploadingImage}
              >
                {isSaving ? 'Creazione Gruppo...' : 'Crea Gruppo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
