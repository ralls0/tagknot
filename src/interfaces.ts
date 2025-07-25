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
  groupId?: string; // NEW: Optional ID of the group this event belongs to
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
  type: 'like' | 'comment' | 'follow' | 'share' | 'group_invite'; // Aggiunto 'group_invite'
  fromUserId: string;
  fromUsername: string;
  eventId?: string; // Optional for follow notifications
  eventTag?: string; // Optional for follow notifications
  commentId?: string; // Optional for comment notifications
  groupId?: string; // NEW: Optional for group_invite notifications
  groupName?: string; // NEW: Optional for group_invite notifications
  message: string;
  createdAt: Timestamp;
  read: boolean;
  imageUrl?: string; // Optional, e.g., event cover image or profile image
}

export interface NotificationType extends NotificationData {
  id: string;
}

export interface AuthContextType {
  currentUser: any;
  loading: boolean;
  userId: string | null;
  userProfile: UserProfile | null;
}

export interface FollowButtonProps {
  isFollowing: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export interface SpotCalendarProps {
  spots: EventType[];
  knots: KnotType[]; // Aggiunto per i Knot
  onShowSpotDetail: (event: EventType | KnotType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void;
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
  groupId?: string; // NEW: Optional ID of the group this knot belongs to
  createdAt: Timestamp;
}

export interface KnotType extends KnotData {
  id: string; // Document ID from Firestore
}

export interface AlertMessageProps {
  message: string;
  type: 'success' | 'error' | '';
}

export interface EventDetailModalProps {
  event: EventType;
  onClose: () => void;
  relatedEvents: EventType[];
  initialIndex: number;
  activeTab: string;
  onRemoveTagFromEvent: (eventId: string) => Promise<void>;
  onLikeToggle: (eventId: string, isLiked: boolean, eventIsPublic: boolean, eventCreatorId: string) => Promise<void>;
  onShareEvent: (event: EventType) => void;
  onUpdateEvent: (updatedEvent: EventType) => void;
  onAddSpotToKnot: (spot: EventType) => void;
}

export interface KnotDetailModalProps {
  knot: KnotType;
  onClose: () => void;
  onShowEventDetail: (event: EventType | KnotType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; // Aggiornata la firma
  onLikeToggle: (eventId: string, isLiked: boolean, eventIsPublic: boolean, eventCreatorId: string) => Promise<void>;
  onShareEvent: (event: EventType) => void;
  onAddSpotToKnot: (spot: EventType) => void;
  onEditEvent: (event: EventType) => void;
  onDeleteEvent: (eventId: string, isPublic: boolean, creatorId: string, groupId?: string) => Promise<void>;
  onRemoveTagFromEvent: (eventId: string) => Promise<void>;
}

// NEW: Group Interfaces
export interface GroupData {
  type: 'group'; // Discriminator property
  name: string;
  description: string;
  profileImage?: string; // Base64 string or URL (optional)
  members: string[]; // Array of user UIDs who are members
  creatorId: string;
  createdAt: Timestamp;
}

export interface GroupType extends GroupData {
  id: string; // Document ID from Firestore
}

export interface GroupsPageProps {
  onShowCreateGroup: () => void;
  onShowGroupDetail: (group: GroupType) => void;
}

// NEW: GroupCardProps
export interface GroupCardProps {
  group: GroupType;
  onShowGroupDetail: (group: GroupType) => void;
}

export interface CreateGroupModalProps {
  onClose: () => void;
  onCreateSuccess: (groupId: string) => void;
}

export interface GroupProfileDisplayProps {
  groupIdToDisplay: string;
  onNavigate: (page: string, id?: string) => void;
  onEditEvent: (event: EventType) => void;
  onDeleteEvent: (eventId: string, isPublic: boolean, creatorId: string, groupId?: string) => Promise<void>;
  onRemoveTagFromEvent: (eventId: string) => Promise<void>;
  onShowEventDetail: (event: EventType | KnotType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; // Aggiornata la firma
  onLikeToggle: (eventId: string, isLiked: boolean, eventIsPublic: boolean, eventCreatorId: string) => Promise<void>;
  onAddSpotToKnot: (spot: EventType) => void;
  onEditKnot: (knot: KnotType) => void;
  onDeleteKnot: (knotId: string, isPublic: boolean, creatorId: string, groupId?: string) => Promise<void>;
  onShowKnotDetail: (knot: KnotType) => void;
  onEditGroupModal: (groupId: string) => void;
}

export interface UserProfileDisplayProps {
  userIdToDisplay: string;
  onNavigate: (page: string, id?: string) => void;
  onEditEvent: (event: EventType) => void;
  onDeleteEvent: (eventId: string, isPublic: boolean, creatorId: string, groupId?: string) => Promise<void>;
  onRemoveTagFromEvent: (eventId: string) => Promise<void>;
  onShowEventDetail: (event: EventType | KnotType, relatedEvents?: EventType[], activeTab?: string, isShareAction?: boolean) => void; // Aggiornata la firma
  onLikeToggle: (eventId: string, isLiked: boolean, eventIsPublic: boolean, eventCreatorId: string) => Promise<void>;
  onAddSpotToKnot: (spot: EventType) => void;
  onEditKnot: (knot: KnotType) => void;
  onDeleteKnot: (knotId: string, isPublic: boolean, creatorId: string, groupId?: string) => Promise<void>;
  onShowKnotDetail: (knot: KnotType) => void; // Aggiunta la prop
}
