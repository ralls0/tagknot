import { Timestamp } from 'firebase/firestore';

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

export interface UserProfile extends UserProfileData {
  id: string; // Document ID from Firestore
}

export interface EventData {
  type: 'event'; // Discriminator property for search results
  creatorId: string;
  creatorUsername: string;
  creatorProfileImage: string;
  tag: string; // e.g., #PartyNight
  description: string;
  coverImage: string; // Base64 string or URL
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  locationName: string;
  locationCoords: { lat: number; lng: number } | null;
  taggedUsers: string[]; // Array of profileTags
  isPublic: boolean;
  likes: string[]; // Array of user UIDs who liked it
  commentCount: number;
  knotIds: string[]; // NEW: Array of KnotType IDs this event belongs to
  createdAt: Timestamp;
}

export interface EventType extends EventData {
  id: string; // Document ID from Firestore
}

export interface CommentData {
  userId: string;
  username: string;
  text: string;
  createdAt: Timestamp;
}

export interface CommentType extends CommentData {
  id: string;
}

export interface NotificationData {
  type: 'like' | 'comment' | 'follow' | 'tag' | 'share';
  fromUserId: string;
  fromUsername: string;
  eventId?: string; // Optional, for like/comment/tag notifications
  eventTag?: string; // Optional, for event-related notifications
  message: string;
  createdAt: Timestamp;
  read: boolean;
  imageUrl?: string; // Optional, e.g., event cover image or user profile image
}

export interface NotificationType extends NotificationData {
  id: string;
}

export interface AuthContextType {
  currentUser: import('firebase/auth').User | null;
  userId: string | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

export interface EventDetailModalProps {
  event: EventType;
  onClose: () => void;
  relatedEvents: EventType[];
  initialIndex: number;
  activeTab: string;
  onRemoveTagFromEvent: (eventId: string) => Promise<void>;
  onLikeToggle: (eventId: string, isLiked: boolean) => Promise<void>;
  onShareEvent: (event: EventType) => void;
  onAddSpotToKnot: (spot: EventType) => void;
  onUpdateEvent: (updatedEvent: EventType) => void; // Nuova prop
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

// NEW: Knot Interfaces
export interface KnotData {
  type: 'knot'; // Discriminator property
  creatorId: string;
  creatorUsername: string;
  creatorProfileImage: string;
  tag: string; // Title/name of the knot, e.g., #SummerTrip2024
  description: string;
  coverImage?: string; // Base64 string or URL (optional)
  locationName?: string; // Optional main location for the knot
  locationCoords?: { lat: number; lng: number } | null; // Optional main coordinates
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  spotIds: string[]; // Array of EventType IDs included in this knot
  status: 'public' | 'private' | 'internal'; // Public, Private, or Internal (for groups)
  createdAt: Timestamp;
}

export interface KnotType extends KnotData {
  id: string; // Document ID from Firestore
}

export interface AlertMessageProps {
  message: string;
  type: 'success' | 'error' | '';
}

// Aggiornata per includere i Knot
export interface SpotCalendarProps {
  spots: EventType[];
  knots: KnotType[]; // Aggiunto per i Knot
  onShowSpotDetail: (event: EventType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void;
  onShowKnotDetail?: (knot: KnotType) => void; // Opzionale, se vuoi un modale di dettaglio per i Knot
}
