import React, { useState, useRef, useEffect } from 'react';
import { BandcampTrack } from '../../hooks/useBandcampTracks';

interface BandcampIframeProps {
  track: BandcampTrack;
}

const BandcampIframe: React.FC<BandcampIframeProps> = ({ track }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const iframeRef = useRef<HTMLDivElement>(null);

  const embedType = track.type === 'album' ? 'album' : 'track';
  // ANCIEN: bgcol=333333 (gris foncé)
  // NOUVEAU: bgcol=1a1a1a (gris très foncé, plus transparent)
  const embedUrl = `https://bandcamp.com/EmbeddedPlayer/${embedType}=${track.trackId}/size=large/bgcol=1a1a1a/linkcol=${track.linkColor}/tracklist=false/artwork=small/transparent=true/`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoaded) {
          setIsVisible(true);
          setIsLoaded(true);
        }
      },
      { 
        rootMargin: '200px', // Charger 200px avant d'être visible
        threshold: 0.1 
      }
    );

    if (iframeRef.current) {
      observer.observe(iframeRef.current);
    }

    return () => observer.disconnect();
  }, [isLoaded]);

  return (
    <div 
      ref={iframeRef}
      style={{
        width: '100%', 
        height: '120px',
        backgroundColor: '#333333',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      {isVisible ? (
        <iframe 
          style={{border: 0, width: '100%', height: '120px', borderRadius: '4px'}} 
          src={embedUrl}
          loading="lazy"
          title={`${track.title} by ${track.artist}`}
        >
          <a href={track.url}>{track.title} by {track.artist}</a>
        </iframe>
      ) : (
        <div style={{
          color: '#fe7eaf',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          🎵 {track.title}<br/>
          <span style={{color: '#999', fontSize: '12px'}}>by {track.artist}</span>
        </div>
      )}
    </div>
  );
};

export default BandcampIframe;
