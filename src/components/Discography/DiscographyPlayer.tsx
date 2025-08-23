/**
 * Section Disco vide - à faire plus tard
 */

import React from 'react'

interface DiscographyPlayerProps {
  tracks?: any[];
  playlistUrl?: string;
  onBackgroundChange?: (url: string) => void;
}

const DiscographyPlayer: React.FC<DiscographyPlayerProps> = ({ onBackgroundChange }) => {
  return (
    <div className="discography-player">
      <div style={{ 
        color: 'white', 
        textAlign: 'center', 
        padding: '50px 20px',
        fontSize: '18px',
        opacity: 0.7
      }}>
        Section en construction...
      </div>
    </div>
  )
}

export default DiscographyPlayer
