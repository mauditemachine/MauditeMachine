import React from 'react';
import InstagramFeed from './InstagramFeed';

interface MediasProps {
  onBackgroundChange?: (url: string) => void;
}

const Medias: React.FC<MediasProps> = ({ onBackgroundChange }) => {
  return (
    <div className="medias-container">
      <div className="section-scroll">
        <InstagramFeed />
      </div>
    </div>
  );
};

export default Medias;


