import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp, writeBatch, query, collection, where, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import AlertMessage from './AlertMessage';
import LoadingSpinner from './LoadingSpinner';
import { KnotType, KnotData, GroupType } from '../interfaces';

const appId = "tagknot-app";

// Funzione per ridimensionare e convertire un'immagine in Base64 (copiata da EditSpotModal)
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

interface EditKnotModalProps {
  knot: KnotType;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const EditKnotModal: React.FC<EditKnotModalProps> = ({ knot, onClose, onSaveSuccess }) => {
  const { userId, userProfile } = useAuth();
  const [editTag, setEditTag] = useState(knot.tag);
  const [editDescription, setEditDescription] = useState(knot.description);
  const [editCoverImageFile, setEditCoverImageFile] = useState<File | null>(null);
  const [editCoverImageUrlInput, setEditCoverImageUrlInput] = useState(knot.coverImage || '');
  const [editLocationName, setEditLocationName] = useState(knot.locationName || '');
  const [editLocationCoords, setEditLocationCoords] = useState(knot.locationCoords || null);
  const [editStartDate, setEditStartDate] = useState(knot.startDate);
  const [editEndDate, setEditEndDate] = useState(knot.endDate);
  const [editStatus, setEditStatus] = useState(knot.status);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // NEW: Group related states
  const [editSelectedGroupId, setEditSelectedGroupId] = useState<string | null>(knot.groupId || null);
  const [userGroups, setUserGroups] = useState<GroupType[]>([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(true);

  // Fetch user's groups
  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      if (isMounted) setLoadingUserGroups(false);
      return;
    }

    setLoadingUserGroups(true);
    const q = query(
      collection(db, `artifacts/${appId}/public/data/groups`),
      where('members', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isMounted) {
        const groups: GroupType[] = [];
        snapshot.forEach(doc => {
          // Correzione qui: cast a Omit<GroupType, 'id'> e poi aggiungi l'id
          const data = doc.data() as Omit<GroupType, 'id'>;
          groups.push({ id: doc.id, ...data });
        });
        setUserGroups(groups);
        setLoadingUserGroups(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching user groups:", error);
        setLoadingUserGroups(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditCoverImageFile(e.target.files[0]);
      setEditCoverImageUrlInput('');
    }
  };

  const handleImageUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditCoverImageUrlInput(e.target.value);
    setEditCoverImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !userProfile) {
      setMessage('Utente non autenticato. Impossibile salvare le modifiche.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');
    let finalCoverImage = knot.coverImage || ''; // Default to existing image

    try {
      if (editCoverImageUrlInput && editCoverImageUrlInput !== (knot.coverImage || '')) {
        finalCoverImage = editCoverImageUrlInput;
      } else if (editCoverImageFile) {
        setIsUploadingImage(true);
        finalCoverImage = await resizeAndConvertToBase64(editCoverImageFile, 800, 600);
        setIsUploadingImage(false);
      } else if (!editCoverImageUrlInput && !editCoverImageFile) {
        finalCoverImage = ''; // If both cleared, remove image
      }

      const batch = writeBatch(db);

      // Gestione del cambio di gruppo o stato
      const oldGroupId = knot.groupId;
      const newGroupId = editSelectedGroupId;
      const newStatus = newGroupId ? 'internal' : editStatus; // Se in gruppo, lo stato è internal

      // 1. Aggiorna il documento del knot nella sua posizione corrente
      let currentKnotRef;
      if (oldGroupId) {
        currentKnotRef = doc(db, `artifacts/${appId}/public/data/groups/${oldGroupId}/knots`, knot.id);
      } else {
        currentKnotRef = doc(db, `artifacts/${appId}/users/${userId}/knots`, knot.id);
      }

      const updatedKnotData: Partial<KnotData> = {
        tag: editTag,
        description: editDescription,
        coverImage: finalCoverImage,
        locationName: editLocationName,
        locationCoords: editLocationCoords,
        startDate: editStartDate,
        endDate: editEndDate,
        status: newStatus, // Usa il nuovo stato (internal se in gruppo)
        groupId: newGroupId || undefined, // Imposta il nuovo groupId o undefined se rimosso
        createdAt: knot.createdAt, // Mantieni la data di creazione originale
      };

      // Se il knot era in un gruppo e ora non lo è più, o viceversa, o cambia gruppo
      if (oldGroupId !== newGroupId) {
        // Se il knot era in un gruppo (oldGroupId) e ora non lo è più o cambia gruppo
        if (oldGroupId) {
          batch.delete(currentKnotRef); // Elimina dalla vecchia posizione del gruppo
        } else {
          // Se era nella collezione privata dell'utente e ora va in un gruppo
          batch.delete(currentKnotRef); // Elimina dalla collezione privata dell'utente
        }

        // Se il knot va in un nuovo gruppo
        if (newGroupId) {
          const newGroupKnotRef = doc(db, `artifacts/${appId}/public/data/groups/${newGroupId}/knots`, knot.id);
          batch.set(newGroupKnotRef, { ...knot, ...updatedKnotData, groupId: newGroupId, status: 'internal', createdAt: knot.createdAt }); // Crea nella nuova posizione del gruppo
        } else {
          // Se non va in nessun gruppo (torna alla collezione privata dell'utente)
          const newUserKnotRef = doc(db, `artifacts/${appId}/users/${userId}/knots`, knot.id);
          batch.set(newUserKnotRef, { ...knot, ...updatedKnotData, groupId: undefined, status: editStatus, createdAt: knot.createdAt }); // Crea nella collezione privata dell'utente
        }

        // Gestione della collezione pubblica globale
        const publicKnotRef = doc(db, `artifacts/${appId}/public/data/knots`, knot.id);
        if (oldGroupId && !newGroupId && editStatus === 'public') {
          // Era in un gruppo, ora è privato dell'utente e pubblico: aggiungi a public/data/knots
          batch.set(publicKnotRef, { ...knot, ...updatedKnotData, groupId: undefined, status: 'public', createdAt: knot.createdAt });
        } else if (!oldGroupId && knot.status === 'public' && !newGroupId && editStatus !== 'public') {
          // Era pubblico, ora è privato dell'utente e non pubblico: rimuovi da public/data/knots
          batch.delete(publicKnotRef);
        } else if (!oldGroupId && knot.status !== 'public' && !newGroupId && editStatus === 'public') {
          // Era privato dell'utente, ora è pubblico: aggiungi a public/data/knots
          batch.set(publicKnotRef, { ...knot, ...updatedKnotData, groupId: undefined, status: 'public', createdAt: knot.createdAt });
        } else if (newGroupId) {
          // Va in un gruppo: rimuovi da public/data/knots se presente
          const publicDocSnap = await getDoc(publicKnotRef);
          if (publicDocSnap.exists()) {
            batch.delete(publicKnotRef);
          }
        }
      } else {
        // Nessun cambio di gruppo, aggiorna semplicemente il documento nella sua posizione corrente
        // e gestisci lo stato pubblico per la collezione pubblica globale se necessario
        batch.update(currentKnotRef, updatedKnotData);

        const publicKnotRef = doc(db, `artifacts/${appId}/public/data/knots`, knot.id);
        if (!newGroupId) { // Solo se non è in un gruppo
          if (newStatus === 'public' && knot.status !== 'public') {
            // Era privato dell'utente, ora è pubblico: aggiungi a public/data/knots
            batch.set(publicKnotRef, { ...knot, ...updatedKnotData, status: 'public', createdAt: knot.createdAt });
          } else if (newStatus !== 'public' && knot.status === 'public') {
            // Era pubblico, ora è privato dell'utente: rimuovi da public/data/knots
            batch.delete(publicKnotRef);
          } else if (newStatus === 'public' && knot.status === 'public') {
            // Era e rimane pubblico: aggiorna anche il documento pubblico
            batch.update(publicKnotRef, updatedKnotData);
          }
        }
      }

      await batch.commit();

      setMessage('Knot modificato con successo!');
      setMessageType('success');
      onSaveSuccess();
    } catch (error) {
      console.error("Error saving knot:", error);
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
          <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Modifica Knot</h3>
          <AlertMessage message={message} type={messageType} />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="editTag" className="block text-sm font-medium text-gray-700 mb-1">Nome Knot</label>
              <input
                type="text"
                id="editTag"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editTag}
                onChange={(e) => setEditTag(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <textarea
                id="editDescription"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              ></textarea>
            </div>
            <div>
              <label htmlFor="editCoverImageFile" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina Knot (Carica File)</label>
              <input
                type="file"
                id="editCoverImageFile"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                disabled={!!editCoverImageUrlInput}
              />
              <p className="text-center text-gray-500 my-2">O</p>
              <label htmlFor="editCoverImageUrl" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina Knot (da URL)</label>
              <input
                type="url"
                id="editCoverImageUrl"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editCoverImageUrlInput}
                onChange={(e) => setEditCoverImageUrlInput(e.target.value)}
                placeholder="Es. https://example.com/knot_image.jpg"
                disabled={!!editCoverImageFile}
              />
              {isUploadingImage && (
                <div className="flex items-center justify-center mt-2 text-gray-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                  Caricamento immagine...
                </div>
              )}
            </div>
            <div>
              <label htmlFor="editLocationName" className="block text-sm font-medium text-gray-700 mb-1">Posizione Principale Knot (Opzionale)</label>
              <input
                type="text"
                id="editLocationName"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                value={editLocationName}
                onChange={(e) => setEditLocationName(e.target.value)}
                placeholder="Es. Alpi Italiane"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="editStartDate" className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                <input
                  type="date"
                  id="editStartDate"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="editEndDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                <input
                  type="date"
                  id="editEndDate"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="editKnotGroupId" className="block text-sm font-medium text-gray-700 mb-1">Associa a un Gruppo (Opzionale)</label>
              {loadingUserGroups ? (
                <div className="flex items-center text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 mr-2"></div>
                  Caricamento gruppi...
                </div>
              ) : (
                <select
                  id="editKnotGroupId"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  value={editSelectedGroupId || ''}
                  onChange={(e) => setEditSelectedGroupId(e.target.value || null)}
                >
                  <option value="">Nessun Gruppo</option>
                  {userGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              )}
            </div>
            {!editSelectedGroupId && ( // Mostra solo se non è associato a un gruppo
              <div>
                <label htmlFor="editStatus" className="block text-sm font-medium text-gray-700 mb-1">Stato Knot</label>
                <select
                  id="editStatus"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'public' | 'private' | 'internal')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <option value="public">Pubblico (visibile a tutti)</option>
                  <option value="private">Privato (visibile solo a te)</option>
                  <option value="internal">Interno (visibile a gruppi specifici - funzionalità futura)</option>
                </select>
              </div>
            )}
          </form>
          <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
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
              onClick={handleSubmit} // Aggiunto onClick per il submit del form
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              disabled={isSaving || isUploadingImage}
            >
              {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditKnotModal;
