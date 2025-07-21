import React from 'react';
import { FollowButtonProps } from '../interfaces';

const FollowButton = ({ isFollowing, onToggle, disabled = false }: FollowButtonProps) => (
  <button
    onClick={onToggle}
    className={`px-3 py-1 rounded-full text-xs font-semibold ${isFollowing ? 'bg-gray-300 text-gray-800' : 'bg-gray-800 text-white hover:bg-gray-900'} transition-colors duration-200`}
    disabled={disabled}
  >
    {isFollowing ? 'Segui già' : 'Segui'}
  </button>
);

export default FollowButton;
