import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { EventData, KnotData } from '../interfaces'; // Importa KnotData

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
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error("Impossibile ottenere il contesto del canvas."));
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
  const { currentUser, userId, userProfile } = useAuth();

  const [contentType, setContentType] = useState<'spot' | 'knot'>('spot'); // Nuovo stato per il tipo di contenuto
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImageLink, setCoverImageLink] = useState('');
  const [date, setDate] = useState(''); // Per Spot
  const [time, setTime] = useState(''); // Per Spot
  const [startDate, setStartDate] = useState(''); // Per Knot
  const [endDate, setEndDate] = useState(''); // Per Knot
  const [locationSearch, setLocationSearch] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [taggedUsers, setTaggedUsers] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [knotStatus, setKnotStatus] = useState<'public' | 'private' | 'internal'>('public'); // Per Knot

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(-1);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);

  // Logica per i suggerimenti di posizione
  useEffect(() => {
    let isMounted = true;
    const delayDebounceFn = setTimeout(async () => {
      if (locationSearch.length > 2) {
        setLoadingLocationSuggestions(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&addressdetails=1`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (isMounted) {
            if (data && data.length > 0) {
              setLocationSuggestions(data.map((p: any) => ({
                display_name: p.display_name,
                lat: p.lat,
                lon: p.lon
              })));
            } else {
              setLocationSuggestions([]);
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error fetching place suggestions from Nominatim:", error);
            setMessage('Errore nel recupero dei suggerimenti di posizione.');
            setMessageType('error');
            setLocationSuggestions([]);
          }
        } finally {
          if (isMounted) {
            setLoadingLocationSuggestions(false);
          }
        }
      } else {
        if (isMounted) {
          setLocationSuggestions([]);
        }
      }
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [locationSearch]);

  const handleSelectLocation = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setLocationSearch(suggestion.display_name);
    setLocationName(suggestion.display_name);
    setLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setLocationSuggestions([]); // Nasconde i suggerimenti dopo la selezione
    setSelectedLocationIndex(-1);
    setMessage('');
    setMessageType('');
  };

  const handleKeyDownOnLocationSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedLocationIndex((prev: number) => Math.min(prev + 1, locationSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedLocationIndex((prev: number) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedLocationIndex !== -1) {
      e.preventDefault();
      handleSelectLocation(locationSuggestions[selectedLocationIndex]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !userId || !userProfile) {
      setMessage('Errore: Utente non autenticato o profilo non disponibile.');
      setMessageType('error');
      return;
    }

    if (!tag.trim()) {
      setMessage(`Il Tag (Titolo ${contentType === 'spot' ? 'Spot' : 'Knot'}) è obbligatorio.`);
      setMessageType('error');
      return;
    }

    if (contentType === 'spot') {
      if (!date || !time) {
        setMessage('Per favore, compila tutti i campi obbligatori (Data, Ora) per lo Spot.');
        setMessageType('error');
        return;
      }
    } else { // contentType === 'knot'
      if (!startDate || !endDate) {
        setMessage('Per favore, compila tutti i campi obbligatori (Data Inizio, Data Fine) per il Knot.');
        setMessageType('error');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setMessage('La Data di Inizio del Knot non può essere successiva alla Data di Fine.');
        setMessageType('error');
        return;
      }
    }

    if (locationSearch && (!locationName || !locationCoords)) {
      setMessage('Per favore, seleziona una posizione valida dai suggerimenti o lascia il campo vuoto.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');

    let finalCoverImage = '';
    if (coverImageLink) {
      finalCoverImage = coverImageLink;
    } else if (coverImageFile) {
      setIsUploadingImage(true);
      try {
        finalCoverImage = await resizeAndConvertToBase64(coverImageFile, 800, 600);
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        setMessage('Errore nel caricamento dell\'immagine. Riprova.');
        setMessageType('error');
        setIsSaving(false);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    try {
      if (contentType === 'spot') {
        const newEvent: EventData = {
          type: 'event',
          creatorId: userId,
          creatorUsername: userProfile.username,
          creatorProfileImage: userProfile.profileImage,
          tag: tag.startsWith('#') ? tag : `#${tag}`,
          description,
          coverImage: finalCoverImage,
          date,
          time,
          locationName,
          locationCoords,
          taggedUsers: taggedUsers.split(',').map(u => u.trim()).filter(u => u),
          isPublic,
          likes: [],
          commentCount: 0,
          createdAt: serverTimestamp() as Timestamp,
        };

        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), newEvent);
        if (isPublic) {
          await addDoc(collection(db, `artifacts/${appId}/public/data/events`), newEvent);
        }
        setMessage('Spot creato con successo!');
        setMessageType('success');
      } else { // contentType === 'knot'
        const newKnot: KnotData = {
          type: 'knot',
          creatorId: userId,
          creatorUsername: userProfile.username,
          creatorProfileImage: userProfile.profileImage,
          tag: tag.startsWith('#') ? tag : `#${tag}`,
          description,
          coverImage: finalCoverImage,
          locationName: locationName || undefined,
          locationCoords: locationCoords || undefined,
          startDate,
          endDate,
          spotIds: [], // Inizialmente vuoto, gli spot verranno aggiunti dopo
          status: knotStatus,
          createdAt: serverTimestamp() as Timestamp,
        };

        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/knots`), newKnot);
        if (knotStatus === 'public') {
          await addDoc(collection(db, `artifacts/${appId}/public/data/knots`), newKnot);
        }
        setMessage('Knot creato con successo!');
        setMessageType('success');
      }

      // Reset form fields
      setTag('');
      setDescription('');
      setCoverImageFile(null);
      setCoverImageLink('');
      setDate('');
      setTime('');
      setStartDate('');
      setEndDate('');
      setLocationSearch('');
      setLocationName('');
      setLocationCoords(null);
      setTaggedUsers('');
      setIsPublic(true);
      setKnotStatus('public');

      onEventCreated(); // Trigger navigation or other actions after creation
    } catch (error) {
      console.error(`Error creating ${contentType}:`, error);
      setMessage(`Errore durante la creazione dello ${contentType}: ` + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">
          Crea Nuovo {contentType === 'spot' ? 'Spot' : 'Knot'}
        </h1>
        <AlertMessage message={message} type={messageType} />

        <div className="mb-6 flex justify-center space-x-4">
          <button
            type="button"
            onClick={() => setContentType('spot')}
            className={`px-6 py-2 rounded-full font-semibold transition-all duration-200 ${
              contentType === 'spot' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Crea Spot
          </button>
          <button
            type="button"
            onClick={() => setContentType('knot')}
            className={`px-6 py-2 rounded-full font-semibold transition-all duration-200 ${
              contentType === 'knot' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Crea Knot
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tag">
              Tag (Titolo {contentType === 'spot' ? 'Spot' : 'Knot'})
            </label>
            <input
              type="text"
              id="tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder={contentType === 'spot' ? '#NomeSpot' : '#NomeKnot'}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
              Descrizione
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder={`Descrivi il tuo ${contentType === 'spot' ? 'spot' : 'knot'}...`}
            ></textarea>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="coverImageLink">
              URL Immagine di Copertina (Opzionale)
            </label>
            <input
              type="text"
              id="coverImageLink"
              value={coverImageLink}
              onChange={(e) => { setCoverImageLink(e.target.value); setCoverImageFile(null); }}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
              placeholder="Incolla l'URL di un'immagine"
            />
            <p className="text-center text-gray-500 my-2">-- OPPURE --</p>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="coverImageFile">
              Carica Immagine di Copertina (Opzionale)
            </label>
            <input
              type="file"
              id="coverImageFile"
              accept="image/*"
              onChange={(e) => { setCoverImageFile(e.target.files ? e.target.files[0] : null); setCoverImageLink(''); }}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            {isUploadingImage && (
              <div className="flex items-center justify-center mt-4 text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                Caricamento immagine...
              </div>
            )}
            {coverImageFile && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Anteprima:</p>
                <img src={URL.createObjectURL(coverImageFile)} alt="Anteprima copertina" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
              </div>
            )}
          </div>

          {contentType === 'spot' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date">
                  Data Spot
                </label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="time">
                  Ora Spot
                </label>
                <input
                  type="time"
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="startDate">
                  Data Inizio Knot
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="endDate">
                  Data Fine Knot
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="locationSearch">
              Ricerca Posizione (Opzionale)
            </label>
            <input
              type="text"
              id="locationSearch"
              value={locationSearch}
              onChange={(e) => { setLocationSearch(e.target.value); setLocationName(''); setLocationCoords(null); setSelectedLocationIndex(-1); }}
              onKeyDown={handleKeyDownOnLocationSearch}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="Cerca città, indirizzo..."
            />
            {loadingLocationSuggestions && (
              <div className="flex items-center justify-center mt-2 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 mr-2"></div>
                Caricamento suggerimenti...
              </div>
            )}
            {locationSuggestions.length > 0 && (
              <ul className="bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                {locationSuggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                    className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${index === selectedLocationIndex ? 'bg-gray-100' : ''}`}
                    onClick={() => handleSelectLocation(suggestion)}
                  >
                    {suggestion.display_name}
                  </li>
                ))}
              </ul>
            )}
            {locationName && (
              <p className="text-sm text-gray-600 mt-2">Posizione selezionata: <span className="font-semibold">{locationName}</span></p>
            )}
          </div>

          {contentType === 'spot' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taggedUsers">
                Tagga Utenti (separati da virgola)
              </label>
              <input
                type="text"
                id="taggedUsers"
                value={taggedUsers}
                onChange={(e) => setTaggedUsers(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="username1, username2 (usa il tag profilo)"
              />
            </div>
          )}

          {contentType === 'spot' ? (
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-5 w-5 text-gray-700 rounded border-gray-300 focus:ring-gray-500"
              />
              <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                Rendi lo Spot pubblico
              </label>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="knotStatus">
                Stato del Knot
              </label>
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
  );
};

export default CreateContentPage;
