import React from 'react';

interface MediasProps {
  onBackgroundChange?: (url: string) => void;
}

const Medias: React.FC<MediasProps> = ({ onBackgroundChange }) => {
  return (
    <div className="medias-container">
      <h2 style={{ color: 'white', marginBottom: '20px' }}>MEDIAS - PLAYLIST</h2>
      <div className="section-scroll">
        <div style={{ width: '100%', height: '600px' }}>
          <iframe 
            width="100%" 
            height="600" 
            scrolling="no" 
            frameBorder="no" 
            allow="autoplay" 
            src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/mauditemachine/sets/tracks-1&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"
          />
        </div>
      </div>
    </div>
  );
};

export default Medias;


