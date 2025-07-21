import React from 'react';
import { UserAvatarProps } from '../interfaces';

const UserAvatar = ({ imageUrl, username, size = 'md', className = '' }: UserAvatarProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-lg',
    lg: 'w-12 h-12 text-xl',
    xl: 'w-32 h-32 text-6xl',
  };
  const currentSizeClass = sizeClasses[size];

  return (
    imageUrl ? (
      <img
        src={imageUrl}
        alt="Profile"
        className={`${currentSizeClass} rounded-full object-cover border border-gray-400 ${className}`}
        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = `https://placehold.co/${size === 'xl' ? '128x128' : '40x40'}/CCC/333?text=${username ? username[0].toUpperCase() : 'U'}`;
        }}
      />
    ) : (
      <div className={`${currentSizeClass} rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold ${className}`}>
        {username ? username[0].toUpperCase() : 'U'}
      </div>
    )
  );
};

export default UserAvatar;
