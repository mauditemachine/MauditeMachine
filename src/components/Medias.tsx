import React from 'react';
import InstagramFeed from './InstagramFeed';

interface MediasProps {
  onBackgroundChange?: (url: string) => void;
  isMobile?: boolean;
}

const Medias: React.FC<MediasProps> = ({ onBackgroundChange, isMobile = false }) => {
  return (
    <div className="medias-container">
      <div className="section-scroll">
        <InstagramFeed isMobile={isMobile} />
      </div>
    </div>
  );
};

export default Medias;


