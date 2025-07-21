import { Timestamp } from 'firebase/firestore';

// Interfaccia per i dati del profilo utente direttamente nel documento Firestore
export interface UserProfileData {
  type: 'user'; // Discriminator property for search results
  email: string | null;
  username: string;
  profileTag: string;
  profileImage: string; // Will be a Base64 string
  followers: string[];
  following: string[];
  createdAt: Timestamp;
}

// Interfaccia completa per il profilo utente (include l'ID del documento)
export interface UserProfile extends UserProfileData {
  id: string; // Document ID is the userId
}

// Interfaccia per i dati di un evento/spot direttamente nel documento Firestore
export interface EventData {
  type: 'event'; // Discriminator property for search results
  tag: string; // Es. #ConcertoRock
  description: string;
  coverImage: string; // Base64 string or URL
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  locationName: string; // Nome leggibile della posizione
  locationCoords: { lat: number; lng: number } | null; // Coordinate geografiche
  taggedUsers: string[]; // Array di profileTag degli utenti taggati
  isPublic: boolean; // Se l'evento è visibile pubblicamente
  creatorId: string; // ID dell'utente che ha creato l'evento
  creatorUsername: string; // Aggiunto: Username del creatore
  creatorProfileImage: string; // Aggiunto: Immagine profilo del creatore
  likes: string[]; // Array di user IDs che hanno messo "Mi piace"
  commentCount: number; // Numero totale di commenti
  createdAt: Timestamp;
}

// Interfaccia completa per un evento/spot (include l'ID del documento)
export interface EventType extends EventData {
  id: string; // Document ID
}

// Interfaccia per i dati di un commento
export interface CommentData {
  userId: string;
  username: string;
  text: string;
  createdAt: Timestamp;
}

// Interfaccia completa per un commento (include l'ID del documento)
export interface CommentType extends CommentData {
  id: string;
}

// Interfaccia per i dati di una notifica
export interface NotificationData {
  type: 'like' | 'comment' | 'share' | 'follow';
  fromUserId: string;
  fromUsername: string;
  eventId?: string; // Opzionale, per notifiche relative a eventi
  eventTag?: string; // Opzionale, per notifiche relative a eventi
  message: string;
  createdAt: Timestamp;
  read: boolean;
  imageUrl?: string; // Immagine associata (es. cover dell'evento, avatar utente)
}

// Interfaccia completa per una notifica (include l'ID del documento)
export interface NotificationType extends NotificationData {
  id: string;
}

export interface AuthContextType {
  currentUser: import('firebase/auth').User | null;
  userId: string | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

export interface LoadingSpinnerProps {
  message?: string;
}

export interface AlertMessageProps {
  message: string;
  type: 'success' | 'error' | '';
}

export interface UserAvatarProps {
  imageUrl: string | undefined | null;
  username: string | undefined | null;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Define sizes for flexibility
  className?: string;
}

export interface FollowButtonProps {
  isFollowing: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export interface SpotCalendarProps {
  spots: EventType[];
  onShowSpotDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void;
}


export interface AlertMessageProps {
  message: string;
  type: 'success' | 'error' | '';
}