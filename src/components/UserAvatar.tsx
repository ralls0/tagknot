import React from 'react';

interface UserAvatarProps {
  imageUrl: string | undefined | null;
  username: string | undefined | null;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // Define sizes for flexibility
  className?: string;
  onClick?: () => void; // Aggiunto onClick come prop opzionale
}

const UserAvatar: React.FC<UserAvatarProps> = ({ imageUrl, username, size = 'md', className, onClick }) => {
  const getInitials = (name: string | undefined | null) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-20 w-20 text-xl',
  };

  const currentSizeClass = sizeClasses[size];

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-gray-300 text-white font-semibold flex-shrink-0 ${currentSizeClass} ${className || ''} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={username || 'User Avatar'}
          className="h-full w-full rounded-full object-cover"
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            // Fallback to initials if image fails to load
            e.currentTarget.onerror = null;
            e.currentTarget.style.display = 'none'; // Hide the broken image icon
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const initialsSpan = document.createElement('span');
              initialsSpan.textContent = getInitials(username);
              initialsSpan.className = 'absolute'; // Position correctly
              parent.appendChild(initialsSpan);
            }
          }}
        />
      ) : (
        <span>{getInitials(username)}</span>
      )}
    </div>
  );
};

export default UserAvatar;
