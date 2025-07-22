import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { EventData, KnotData } from '../interfaces';

const appId = "tagknot-app";

// Funzione per ridimensionare e convertire un'immagine in Base64
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
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // Comprimi a JPEG con qualità 0.8
        } else {
          reject(new Error("Could not get 2D context for canvas"));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface CreateContentPageProps {
  onEventCreated: () => void;
  onCancelEdit: () => void;
}

const CreateContentPage: React.FC<CreateContentPageProps> = ({ onEventCreated, onCancelEdit }) => {
  const { userId, userProfile } = useAuth();
  const [contentType, setContentType] = useState<'spot' | 'knot'>('spot'); // 'spot' or 'knot'

  // Spot specific states
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [taggedUsersInput, setTaggedUsersInput] = useState('');
  const [isPublic, setIsPublic] = useState(true); // Default to public

  // Knot specific states
  const [knotTag, setKnotTag] = useState('');
  const [knotDescription, setKnotDescription] = useState('');
  const [knotCoverImage, setKnotCoverImage] = useState<File | null>(null);
  const [knotLocationName, setKnotLocationName] = useState('');
  const [knotLocationCoords, setKnotLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [knotStartDate, setKnotStartDate] = useState('');
  const [knotEndDate, setKnotEndDate] = useState('');
  const [knotStatus, setKnotStatus] = useState<'public' | 'private' | 'internal'>('public'); // Default to public

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (contentType === 'spot') {
        setCoverImage(e.target.files[0]);
      } else {
        setKnotCoverImage(e.target.files[0]);
      }
    }
  };

  const handleLocationSearch = async () => {
    if (!locationName.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        setLocationCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setMessage('Posizione trovata!');
        setMessageType('success');
      } else {
        setLocationCoords(null);
        setMessage('Posizione non trovata. Inserisci manualmente o riprova.');
        setMessageType('error');
      }
    } catch (error) {
      console.error("Error fetching location:", error);
      setMessage('Errore durante la ricerca della posizione.');
      setMessageType('error');
    }
  };

  const handleKnotLocationSearch = async () => {
    if (!knotLocationName.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(knotLocationName)}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        setKnotLocationCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setMessage('Posizione trovata per il Knot!');
        setMessageType('success');
      } else {
        setKnotLocationCoords(null);
        setMessage('Posizione non trovata per il Knot. Inserisci manualmente o riprova.');
        setMessageType('error');
      }
    } catch (error) {
      console.error("Error fetching knot location:", error);
      setMessage('Errore durante la ricerca della posizione del Knot.');
      setMessageType('error');
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !userProfile) {
      setMessage('Utente non autenticato. Impossibile creare contenuto.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');
    let finalCoverImage = '';

    try {
      if (contentType === 'spot') {
        if (!tag || !date || !time || !locationName) {
          setMessage('Per favore, compila tutti i campi obbligatori per lo Spot.');
          setMessageType('error');
          setIsSaving(false);
          return;
        }

        if (coverImage) {
          setIsUploadingImage(true);
          finalCoverImage = await resizeAndConvertToBase64(coverImage, 800, 600);
          setIsUploadingImage(false);
        }

        const parsedTaggedUsers = taggedUsersInput.split(',').map(t => t.trim()).filter(t => t);

        // Genera un ID per il documento prima di salvarlo
        const newEventRef = doc(collection(db, `artifacts/${appId}/users/${userId}/events`));
        const eventId = newEventRef.id;

        const newEventData: EventData = {
          type: 'event',
          creatorId: userId,
          creatorUsername: userProfile.username,
          creatorProfileImage: userProfile.profileImage,
          tag,
          description,
          coverImage: finalCoverImage,
          date,
          time,
          locationName,
          locationCoords,
          taggedUsers: parsedTaggedUsers,
          isPublic,
          likes: [],
          commentCount: 0,
          knotIds: [],
          createdAt: serverTimestamp() as Timestamp,
        };

        // Salva sempre nella collezione privata dell'utente
        await setDoc(newEventRef, newEventData);

        // Se pubblico, salva anche nella collezione pubblica con lo stesso ID
        if (isPublic) {
          await setDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId), newEventData);
        }

        setMessage('Spot creato con successo!');
        setMessageType('success');
        onEventCreated(); // Notifica il componente padre
      } else { // contentType === 'knot'
        if (!knotTag || !knotStartDate || !knotEndDate) {
          setMessage('Per favore, compila tutti i campi obbligatori per il Knot.');
          setMessageType('error');
          setIsSaving(false);
          return;
        }

        if (new Date(knotStartDate) > new Date(knotEndDate)) {
          setMessage('La data di inizio del Knot non può essere successiva alla data di fine.');
          setMessageType('error');
          setIsSaving(false);
          return;
        }

        if (knotCoverImage) {
          setIsUploadingImage(true);
          finalCoverImage = await resizeAndConvertToBase64(knotCoverImage, 800, 600);
          setIsUploadingImage(false);
        }

        // Genera un ID per il documento prima di salvarlo
        const newKnotRef = doc(collection(db, `artifacts/${appId}/users/${userId}/knots`));
        const knotId = newKnotRef.id;

        const newKnotData: KnotData = {
          type: 'knot',
          creatorId: userId,
          creatorUsername: userProfile.username,
          creatorProfileImage: userProfile.profileImage,
          tag: knotTag,
          description: knotDescription,
          coverImage: finalCoverImage,
          locationName: knotLocationName,
          locationCoords: knotLocationCoords,
          startDate: knotStartDate,
          endDate: knotEndDate,
          spotIds: [], // Knot starts with no spots
          status: knotStatus,
          createdAt: serverTimestamp() as Timestamp,
        };

        // Salva sempre nella collezione privata dell'utente
        await setDoc(newKnotRef, newKnotData);

        // Se pubblico, salva anche nella collezione pubblica con lo stesso ID
        if (knotStatus === 'public') {
          await setDoc(doc(db, `artifacts/${appId}/public/data/knots`, knotId), newKnotData);
        }

        setMessage('Knot creato con successo!');
        setMessageType('success');
        onEventCreated(); // Notifica il componente padre (potrebbe essere rinominato in onContentCreated)
      }
    } catch (error) {
      console.error("Error creating content:", error);
      setMessage(`Errore durante la creazione del ${contentType === 'spot' ? 'Spot' : 'Knot'}. Riprova.`);
      setMessageType('error');
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 pt-20">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h2 className="text-3xl font-extrabold text-gray-800 text-center mb-6">
            Crea Nuovo {contentType === 'spot' ? 'Spot' : 'Knot'}
          </h2>
          <AlertMessage message={message} type={messageType} />

          <div className="mb-6 flex justify-center space-x-4">
            <button
              onClick={() => setContentType('spot')}
              className={`px-6 py-3 rounded-full font-semibold text-lg transition-all duration-300 ease-in-out ${
                contentType === 'spot' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Spot
            </button>
            <button
              onClick={() => setContentType('knot')}
              className={`px-6 py-3 rounded-full font-semibold text-lg transition-all duration-300 ease-in-out ${
                contentType === 'knot' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Knot
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {contentType === 'spot' ? (
              <>
                <div>
                  <label htmlFor="tag" className="block text-sm font-medium text-gray-700 mb-1">Tag Spot (es. #PartyNight)</label>
                  <input
                    type="text"
                    id="tag"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                  <textarea
                    id="description"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina</label>
                  <input
                    type="file"
                    id="coverImage"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {isUploadingImage && (
                    <div className="flex items-center justify-center mt-2 text-gray-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                      Caricamento immagine...
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <input
                      type="date"
                      id="date"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
                    <input
                      type="time"
                      id="time"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Posizione</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="location"
                      className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="Es. Roma, Colosseo"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleLocationSearch}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                    >
                      Cerca
                    </button>
                  </div>
                  {locationCoords && (
                    <p className="text-sm text-gray-500 mt-1">Coordinate: {locationCoords.lat}, {locationCoords.lng}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="taggedUsers" className="block text-sm font-medium text-gray-700 mb-1">Tagga Utenti (separati da virgola, usa il tag profilo)</label>
                  <input
                    type="text"
                    id="taggedUsers"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={taggedUsersInput}
                    onChange={(e) => setTaggedUsersInput(e.target.value)}
                    placeholder="username1, username2 (usa il tag profilo)"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-5 w-5 text-gray-700 rounded border-gray-300 focus:ring-gray-500 bg-gray-50"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                    Rendi lo Spot pubblico (visibile nel feed degli utenti che ti seguono)
                  </label>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="knotTag" className="block text-sm font-medium text-gray-700 mb-1">Nome Knot (es. #ViaggioEstate2024)</label>
                  <input
                    type="text"
                    id="knotTag"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={knotTag}
                    onChange={(e) => setKnotTag(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="knotDescription" className="block text-sm font-medium text-gray-700 mb-1">Descrizione Knot</label>
                  <textarea
                    id="knotDescription"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={knotDescription}
                    onChange={(e) => setKnotDescription(e.target.value)}
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="knotCoverImage" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina Knot</label>
                  <input
                    type="file"
                    id="knotCoverImage"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {isUploadingImage && (
                    <div className="flex items-center justify-center mt-2 text-gray-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                      Caricamento immagine...
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="knotLocation" className="block text-sm font-medium text-gray-700 mb-1">Posizione Principale Knot (Opzionale)</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="knotLocation"
                      className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      value={knotLocationName}
                      onChange={(e) => setKnotLocationName(e.target.value)}
                      placeholder="Es. Alpi Italiane"
                    />
                    <button
                      type="button"
                      onClick={handleKnotLocationSearch}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                    >
                      Cerca
                    </button>
                  </div>
                  {knotLocationCoords && (
                    <p className="text-sm text-gray-500 mt-1">Coordinate: {knotLocationCoords.lat}, {knotLocationCoords.lng}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="knotStartDate" className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                    <input
                      type="date"
                      id="knotStartDate"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      value={knotStartDate}
                      onChange={(e) => setKnotStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="knotEndDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                    <input
                      type="date"
                      id="knotEndDate"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      value={knotEndDate}
                      onChange={(e) => setKnotEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="knotStatus" className="block text-sm font-medium text-gray-700 mb-1">Stato Knot</label>
                  <select
                    id="knotStatus"
                    value={knotStatus}
                    onChange={(e) => setKnotStatus(e.target.value as 'public' | 'private' | 'internal')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <option value="public">Pubblico (visibile a tutti)</option>
                    <option value="private">Privato (visibile solo a te)</option>
                    <option value="internal">Interno (visibile a gruppi specifici - funzionalità futura)</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-4 mt-6">
              <button
                type="button"
                onClick={onCancelEdit}
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
                {isSaving ? `Creazione ${contentType === 'spot' ? 'Spot' : 'Knot'}...` : `Crea ${contentType === 'spot' ? 'Spot' : 'Knot'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateContentPage;
