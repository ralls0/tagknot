import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, query, collectionGroup, where, getDocs, writeBatch, arrayUnion, arrayRemove, collection, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import UserAvatar from './UserAvatar';
import { GroupType, UserProfile, NotificationData } from '../interfaces';
import { Timestamp } from 'firebase/firestore';

const appId = "tagknot-app";

// Funzione per ridimensionare e convertire un'immagine in Base64 (riutilizzata)
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

interface EditGroupModalProps {
  group: GroupType;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({ group, onClose, onSaveSuccess }) => {
  const { userId, userProfile } = useAuth();
  const [editGroupName, setEditGroupName] = useState(group.name);
  const [editGroupDescription, setEditGroupDescription] = useState(group.description);
  const [editGroupImageFile, setEditGroupImageFile] = useState<File | null>(null);
  const [editGroupImageUrlInput, setEditGroupImageUrlInput] = useState(group.profileImage || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [currentMembers, setCurrentMembers] = useState<UserProfile[]>([]); // Membri attuali del gruppo
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]); // Membri selezionati per il salvataggio
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // Carica i profili dei membri attuali del gruppo all'apertura del modale
  useEffect(() => {
    let isMounted = true;
    const fetchCurrentMembers = async () => {
      if (!group.members || group.members.length === 0) {
        if (isMounted) {
          setCurrentMembers([]);
          setSelectedMembers([]);
        }
        return;
      }
      try {
        const membersPromises = group.members.map(async (memberId) => {
          const profileRef = doc(db, `artifacts/${appId}/users/${memberId}/profile/data`);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            // Correzione qui: cast a Omit<UserProfile, 'id'> per evitare la duplicazione dell'id
            const data = profileSnap.data() as Omit<UserProfile, 'id'>;
            return { id: profileSnap.id, ...data };
          }
          return null;
        });
        const fetchedMembers = (await Promise.all(membersPromises)).filter((member): member is UserProfile => member !== null);
        if (isMounted) {
          setCurrentMembers(fetchedMembers);
          setSelectedMembers(fetchedMembers); // Inizializza i membri selezionati con quelli attuali
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching current group members:", error);
      }
    };

    fetchCurrentMembers();

    return () => { isMounted = false; };
  }, [group.members]);


  // Gestione ricerca utenti (simile a CreateGroupModal)
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
          const usersByUsername = usernameSnapshot.docs.map(doc => {
            // Correzione qui: cast a Omit<UserProfile, 'id'> per evitare la duplicazione dell'id
            const data = doc.data() as Omit<UserProfile, 'id'>;
            return { id: doc.ref.parent.parent?.id || doc.id, ...data };
          });

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

          const combinedResults = Array.from(new Set([...usersByUsername, ...usersByProfileTag].map(user => user.id)))
            .map(id => [...usersByUsername, ...usersByProfileTag].find(user => user.id === id))
            .filter((user): user is UserProfile => user !== undefined);

          if (isMounted) {
            // Filtra gli utenti già selezionati
            const filteredResults = combinedResults.filter(user =>
              !selectedMembers.some(member => member.id === user.id)
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
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchTerm, selectedMembers]);

  const handleToggleUserSelection = (user: UserProfile) => {
    setSelectedMembers(prev => {
      const isCurrentlySelected = prev.some(member => member.id === user.id);
      if (isCurrentlySelected) {
        // Non permettere di rimuovere il creatore del gruppo o se stesso se è l'unico membro
        if (user.id === group.creatorId || (user.id === userId && prev.length === 1)) {
          setMessage('Non puoi rimuovere il creatore del gruppo o te stesso se sei l\'unico membro.');
          setMessageType('error');
          return prev;
        }
        return prev.filter(member => member.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditGroupImageFile(e.target.files[0]);
      setEditGroupImageUrlInput('');
    }
  };

  const handleImageUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditGroupImageUrlInput(e.target.value);
    setEditGroupImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !userProfile) {
      setMessage('Utente non autenticato. Impossibile salvare le modifiche.');
      setMessageType('error');
      return;
    }
    if (!editGroupName.trim()) {
      setMessage('Il nome del gruppo è obbligatorio.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');
    let finalGroupImage = group.profileImage || '';

    try {
      if (editGroupImageUrlInput && editGroupImageUrlInput !== (group.profileImage || '')) {
        finalGroupImage = editGroupImageUrlInput;
      } else if (editGroupImageFile) {
        setIsUploadingImage(true);
        finalGroupImage = await resizeAndConvertToBase64(editGroupImageFile, 400, 400);
        setIsUploadingImage(false);
      } else if (!editGroupImageUrlInput && !editGroupImageFile) {
        finalGroupImage = '';
      }

      const batch = writeBatch(db);
      const groupRef = doc(db, `artifacts/${appId}/public/data/groups`, group.id);

      const updatedMemberIds = selectedMembers.map(member => member.id);
      const oldMemberIds = currentMembers.map(member => member.id);

      // Trova i membri aggiunti e rimossi
      const addedMembers = selectedMembers.filter(member => !oldMemberIds.includes(member.id));
      const removedMembers = currentMembers.filter(member => !updatedMemberIds.includes(member.id));

      // Aggiorna i dati del gruppo
      batch.update(groupRef, {
        name: editGroupName,
        description: editGroupDescription,
        profileImage: finalGroupImage,
        members: updatedMemberIds,
        // createdAt non viene modificato
      });

      // Invia notifiche ai nuovi membri
      for (const member of addedMembers) {
        const notificationData: NotificationData = {
          type: 'group_invite',
          fromUserId: userId,
          fromUsername: userProfile.username,
          groupId: group.id,
          groupName: editGroupName,
          message: `${userProfile.username} ti ha aggiunto al gruppo "${editGroupName}".`,
          createdAt: serverTimestamp() as Timestamp,
          read: false,
          imageUrl: finalGroupImage || '',
        };
        // Ho verificato che 'collection' è già importato nella riga 2.
        // Se l'errore persiste, assicurati che la versione di firebase/firestore sia compatibile
        // o che non ci siano altri problemi di configurazione dell'ambiente.
        batch.set(doc(collection(db, `artifacts/${appId}/users/${member.id}/notifications`)), notificationData);
      }

      // Potresti voler inviare una notifica ai membri rimossi, ma per ora lo omettiamo per semplicità
      // for (const member of removedMembers) {
      //   const notificationData: NotificationData = {
      //     type: 'group_leave', // Nuovo tipo di notifica
      //     fromUserId: userId,
      //     fromUsername: userProfile.username,
      //     groupId: group.id,
      //     groupName: editGroupName,
      //     message: `${userProfile.username} ti ha rimosso dal gruppo "${editGroupName}".`,
      //     createdAt: serverTimestamp() as Timestamp,
      //     read: false,
      //   };
      //   batch.set(doc(collection(db, `artifacts/${appId}/users/${member.id}/notifications`)), notificationData);
      // }


      await batch.commit();

      setMessage('Gruppo modificato con successo!');
      setMessageType('success');
      onSaveSuccess();
    } catch (error) {
      console.error("Error saving group:", error);
      setMessage('Errore durante il salvataggio delle modifiche. Riprova.');
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
          <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Modifica Gruppo</h3>
          <AlertMessage message={message} type={messageType} />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="editGroupName" className="block text-sm font-medium text-gray-700 mb-1">Nome Gruppo <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="editGroupName"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="editGroupDescription" className="block text-sm font-medium text-gray-700 mb-1">Descrizione Gruppo (Opzionale)</label>
              <textarea
                id="editGroupDescription"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editGroupDescription}
                onChange={(e) => setEditGroupDescription(e.target.value)}
              ></textarea>
            </div>
            <div>
              <label htmlFor="editGroupImageFile" className="block text-sm font-medium text-gray-700 mb-1">Immagine Gruppo (Carica File)</label>
              <input
                type="file"
                id="editGroupImageFile"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                disabled={!!editGroupImageUrlInput}
              />
              <p className="text-center text-gray-500 my-2">O</p>
              <label htmlFor="editGroupImageUrl" className="block text-sm font-medium text-gray-700 mb-1">Immagine Gruppo (da URL)</label>
              <input
                type="url"
                id="editGroupImageUrl"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editGroupImageUrlInput}
                onChange={handleImageUrlInputChange}
                placeholder="Es. https://example.com/group_logo.jpg"
                disabled={!!editGroupImageFile}
              />
              {isUploadingImage && (
                <div className="flex items-center justify-center mt-2 text-gray-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                  Caricamento immagine...
                </div>
              )}
            </div>

            {/* Gestione Membri */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Gestisci Membri</h4>
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
                  <h5 className="text-md font-semibold text-gray-700 mb-2">Membri Attuali:</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map(member => (
                      <span key={member.id} className="bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full flex items-center">
                        {member.username}
                        {member.id !== group.creatorId && ( // Non permettere di rimuovere il creatore
                          <button onClick={() => handleToggleUserSelection(member)} className="ml-2 text-gray-600 hover:text-gray-900">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
                          </button>
                        )}
                        {member.id === group.creatorId && <span className="ml-2 text-xs text-gray-500">(Creatore)</span>}
                        {member.id === userId && member.id !== group.creatorId && <span className="ml-2 text-xs text-gray-500">(Tu)</span>}
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
                {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditGroupModal;
