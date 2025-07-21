import { Timestamp } from 'firebase/firestore';

export interface UserProfileData {
  type: 'user';
  email: string | null;
  username: string;
  profileTag: string;
  profileImage: string; // Base64 string
  followers: string[];
  following: string[];
  createdAt: Timestamp;
}

export interface UserProfile extends UserProfileData {
  id: string;
}

export interface EventData {
  type: 'event';
  tag: string;
  description: string;
  coverImage: string; // Base64 string
  date: string;
  time: string;
  locationName: string;
  locationCoords: { lat: number; lng: number } | null;
  taggedUsers: string[];
  isPublic: boolean;
  creatorId: string;
  likes: string[];
  commentCount: number;
  createdAt: Timestamp;
}

export interface EventType extends EventData {
  id: string;
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
  type: 'like' | 'comment' | 'share';
  fromUserId: string;
  fromUsername: string;
  eventId: string;
  eventTag: string;
  message: string;
  createdAt: Timestamp;
  read: boolean;
  imageUrl: string; // Base64 string
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