import React, { useState, useEffect } from 'react'; // Aggiunto useEffect
import { collection, serverTimestamp, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { EventData, KnotData } from '../interfaces';

const appId = "tagknot-app";

// PER FAVORE, INSERISCI LA TUA CHIAVE API DI GOOGLE MAPS QUI.
// Le variabili d'ambiente (es. process.env.REACT_APP_GOOGLE_MAPS_API_KEY) non sono accessibili
// direttamente in questo ambiente di esecuzione del browser.
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // <--- INSERISCI QUI LA TUA CHIAVE API DI GOOGLE MAPS

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
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImageUrlInput, setCoverImageUrlInput] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationName, setLocationName] = useState(''); // Questo sarà il nome visualizzato e salvato
  const [locationSearchInput, setLocationSearchInput] = useState(''); // Questo sarà l'input per la ricerca
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [taggedUsersInput, setTaggedUsersInput] = useState('');
  const [isPublic, setIsPublic] = useState(true); // Default to public
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(-1);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);


  // Knot specific states
  const [knotTag, setKnotTag] = useState('');
  const [knotDescription, setKnotDescription] = useState('');
  const [knotCoverImageFile, setKnotCoverImageFile] = useState<File | null>(null);
  const [knotCoverImageUrlInput, setKnotCoverImageUrlInput] = useState('');
  const [knotLocationName, setKnotLocationName] = useState(''); // Nome visualizzato e salvato
  const [knotLocationSearchInput, setKnotLocationSearchInput] = useState(''); // Input per la ricerca
  const [knotLocationCoords, setKnotLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [knotStartDate, setKnotStartDate] = useState('');
  const [knotEndDate, setKnotEndDate] = useState('');
  const [knotStatus, setKnotStatus] = useState<'public' | 'private' | 'internal'>('public'); // Default to public
  const [knotLocationSuggestions, setKnotLocationSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [selectedKnotLocationIndex, setSelectedKnotLocationIndex] = useState(-1);
  const [loadingKnotLocationSuggestions, setLoadingKnotLocationSuggestions] = useState(false);


  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (contentType === 'spot') {
        setCoverImageFile(e.target.files[0]);
        setCoverImageUrlInput(''); // Clear URL input if file is selected
      } else {
        setKnotCoverImageFile(e.target.files[0]);
        setKnotCoverImageUrlInput(''); // Clear URL input if file is selected
      }
    }
  };

  const handleImageUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (contentType === 'spot') {
      setCoverImageUrlInput(e.target.value);
      setCoverImageFile(null); // Clear file input if URL is entered
    } else {
      setKnotCoverImageUrlInput(e.target.value);
      setKnotCoverImageFile(null); // Clear file input if URL is entered
    }
  };

  // --- Location Search Logic (unified for Spot and Knot) ---
  type Suggestion = { display_name: string; lat: string; lon: string };

  type GoogleGeocodeResult = {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  };

  type NominatimResult = {
    display_name: string;
    lat: string;
    lon: string;
  };

  const fetchLocationSuggestions = async (
    queryName: string,
    setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ): Promise<void> => {
    if (!queryName || queryName.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let googleSuccess = false;

    // --- Google Maps Geocoding API ---
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryName)}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data: {
          status: string;
          results: GoogleGeocodeResult[];
          error_message?: string;
        } = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
          const mapped = data.results.map((result) => ({
            display_name: result.formatted_address,
            lat: result.geometry.location.lat.toString(),
            lon: result.geometry.location.lng.toString()
          }));
          setSuggestions(mapped);
          googleSuccess = true;
        } else {
          console.warn("Google Maps API response error:", data.status, data.error_message);
        }
      } catch (error) {
        console.error("Errore fetch da Google Maps API:", error);
      }
    } else {
      console.warn("GOOGLE_MAPS_API_KEY non configurata. Utilizzo solo OpenStreetMap.");
    }

    // --- OpenStreetMap Nominatim fallback ---
    if (!googleSuccess) {
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryName)}&format=json&limit=5&addressdetails=1`;
        const response = await fetch(nominatimUrl, {
          headers: { 'Accept-Language': 'it' } // opzionale: forza localizzazione italiana
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: NominatimResult[] = await response.json();
        const mapped = data.map((result) => ({
          display_name: result.display_name,
          lat: result.lat,
          lon: result.lon
        }));
        setSuggestions(mapped);
      } catch (error) {
        console.error("Errore fetch da Nominatim (OpenStreetMap):", error);
        setSuggestions([]);
      }
    }

    setLoading(false);
  };


  // Debounced effect for Spot location search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLocationSuggestions(locationSearchInput, setLocationSuggestions, setLoadingLocationSuggestions);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [locationSearchInput]);

  // Debounced effect for Knot location search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLocationSuggestions(knotLocationSearchInput, setKnotLocationSuggestions, setLoadingKnotLocationSuggestions);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [knotLocationSearchInput]);


  const handleSelectLocation = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setLocationSearchInput(suggestion.display_name);
    setLocationName(suggestion.display_name);
    setLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setLocationSuggestions([]);
    setSelectedLocationIndex(-1);
  };

  const handleSelectKnotLocation = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setKnotLocationSearchInput(suggestion.display_name);
    setKnotLocationName(suggestion.display_name);
    setKnotLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setKnotLocationSuggestions([]);
    setSelectedKnotLocationIndex(-1);
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

  const handleKeyDownOnKnotLocationSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedKnotLocationIndex((prev: number) => Math.min(prev + 1, knotLocationSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedKnotLocationIndex((prev: number) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedKnotLocationIndex !== -1) {
      e.preventDefault();
      handleSelectKnotLocation(knotLocationSuggestions[selectedKnotLocationIndex]);
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
        if (!tag || !date || !time || !locationName || !locationCoords) { // Aggiunto controllo locationCoords
          setMessage('Per favore, compila tutti i campi obbligatori per lo Spot e seleziona una posizione valida.');
          setMessageType('error');
          setIsSaving(false);
          return;
        }

        if (coverImageUrlInput) {
          finalCoverImage = coverImageUrlInput;
        } else if (coverImageFile) {
          setIsUploadingImage(true);
          finalCoverImage = await resizeAndConvertToBase64(coverImageFile, 800, 600);
          setIsUploadingImage(false);
        }

        const parsedTaggedUsers = taggedUsersInput.split(',').map(t => t.trim()).filter(t => t);

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

        await setDoc(newEventRef, newEventData);

        if (isPublic) {
          await setDoc(doc(db, `artifacts/${appId}/public/data/events`, eventId), newEventData);
        }

        setMessage('Spot creato con successo!');
        setMessageType('success');
        onEventCreated();
      } else { // contentType === 'knot'
        if (!knotTag || !knotStartDate || !knotEndDate || !knotLocationName || !knotLocationCoords) { // Aggiunto controllo knotLocationCoords
          setMessage('Per favore, compila tutti i campi obbligatori per il Knot e seleziona una posizione valida.');
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

        if (knotCoverImageUrlInput) {
          finalCoverImage = knotCoverImageUrlInput;
        } else if (knotCoverImageFile) {
          setIsUploadingImage(true);
          finalCoverImage = await resizeAndConvertToBase64(knotCoverImageFile, 800, 600);
          setIsUploadingImage(false);
        }

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
          spotIds: [],
          status: knotStatus,
          createdAt: serverTimestamp() as Timestamp,
        };

        await setDoc(newKnotRef, newKnotData);

        if (knotStatus === 'public') {
          await setDoc(doc(db, `artifacts/${appId}/public/data/knots`, knotId), newKnotData);
        }

        setMessage('Knot creato con successo!');
        setMessageType('success');
        onEventCreated();
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
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4"> {/* Aumentato pt-40 per maggiore spazio */}
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
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
                  <label htmlFor="coverImageFile" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina (Carica File)</label>
                  <input
                    type="file"
                    id="coverImageFile"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    disabled={!!coverImageUrlInput} // Disable if URL is entered
                  />
                  <p className="text-center text-gray-500 my-2">O</p>
                  <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina (da URL)</label>
                  <input
                    type="url"
                    id="coverImageUrl"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={coverImageUrlInput}
                    onChange={handleImageUrlInputChange}
                    placeholder="Es. https://example.com/image.jpg"
                    disabled={!!coverImageFile} // Disable if file is selected
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
                  <label htmlFor="locationSearchInput" className="block text-sm font-medium text-gray-700 mb-1">Ricerca Posizione <span className="text-red-500">* </span></label>
                  <input
                    type="text"
                    id="locationSearchInput"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={locationSearchInput}
                    onChange={(e) => { setLocationSearchInput(e.target.value); setLocationName(''); setLocationCoords(null); setSelectedLocationIndex(-1); }}
                    onKeyDown={handleKeyDownOnLocationSearch}
                    placeholder="Cerca città, indirizzo..."
                    required
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
                  {locationName && locationCoords && (
                    <p className="text-sm text-gray-600 mt-2">
                      Posizione selezionata: <span className="font-semibold">{locationName}</span> (Lat: {locationCoords.lat.toFixed(4)}, Lng: {locationCoords.lng.toFixed(4)})
                    </p>
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
                  <label htmlFor="knotCoverImageFile" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina Knot (Carica File)</label>
                  <input
                    type="file"
                    id="knotCoverImageFile"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    disabled={!!knotCoverImageUrlInput} // Disable if URL is entered
                  />
                  <p className="text-center text-gray-500 my-2">O</p>
                  <label htmlFor="knotCoverImageUrl" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina Knot (da URL)</label>
                  <input
                    type="url"
                    id="knotCoverImageUrl"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={knotCoverImageUrlInput}
                    onChange={handleImageUrlInputChange}
                    placeholder="Es. https://example.com/knot_image.jpg"
                    disabled={!!knotCoverImageFile} // Disable if file is selected
                  />
                  {isUploadingImage && (
                    <div className="flex items-center justify-center mt-2 text-gray-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                      Caricamento immagine...
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="knotLocationSearchInput" className="block text-sm font-medium text-gray-700 mb-1">Posizione Principale Knot (Opzionale)</label>
                  <input
                    type="text"
                    id="knotLocationSearchInput"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={knotLocationSearchInput}
                    onChange={(e) => { setKnotLocationSearchInput(e.target.value); setKnotLocationName(''); setKnotLocationCoords(null); setSelectedKnotLocationIndex(-1); }}
                    onKeyDown={handleKeyDownOnKnotLocationSearch}
                    placeholder="Es. Alpi Italiane"
                  />
                  {loadingKnotLocationSuggestions && (
                    <div className="flex items-center justify-center mt-2 text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 mr-2"></div>
                      Caricamento suggerimenti...
                    </div>
                  )}
                  {knotLocationSuggestions.length > 0 && (
                    <ul className="bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                      {knotLocationSuggestions.map((suggestion, index) => (
                        <li
                          key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${index === selectedKnotLocationIndex ? 'bg-gray-100' : ''}`}
                          onClick={() => handleSelectKnotLocation(suggestion)}
                        >
                          {suggestion.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {knotLocationName && knotLocationCoords && (
                    <p className="text-sm text-gray-600 mt-2">
                      Posizione selezionata: <span className="font-semibold">{knotLocationName}</span> (Lat: {knotLocationCoords.lat.toFixed(4)}, Lng: {knotLocationCoords.lng.toFixed(4)})
                    </p>
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
