import React, { useCallback, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';

interface LandmarkMarkerData {
  id: string;
  title: string;
  subtitle: string;
  position: { lat: number; lng: number };
  color: string;
  glyphColor: string;
  borderColor: string;
}

const WEDDING_LANDMARKS: LandmarkMarkerData[] = [
  {
    id: 'villa',
    title: 'Villa La Selva Estate (Venue)',
    subtitle: 'Ceremony & Reception · Strada di Selva 14, Castelnuovo Berardenga',
    position: { lat: 43.3486, lng: 11.4921 },
    color: '#9f1239',
    glyphColor: '#fff1f2',
    borderColor: '#881337',
  },
  {
    id: 'valet',
    title: 'North Gate Complimentary Valet',
    subtitle: 'Drop-off & Estate Valet Entrance (Opens 3:30 PM CET)',
    position: { lat: 43.3502, lng: 11.4905 },
    color: '#b45309',
    glyphColor: '#fffbeb',
    borderColor: '#78350f',
  },
  {
    id: 'siena',
    title: 'Siena Historic Center',
    subtitle: '22 min drive · Boutique Partner Hotels & Piazza del Campo',
    position: { lat: 43.3188, lng: 11.3308 },
    color: '#1c1917',
    glyphColor: '#fafaf9',
    borderColor: '#0c0a09',
  },
  {
    id: 'shuttle',
    title: 'Florence Grand Hotel Shuttle Hub',
    subtitle: 'Charter coaches depart 3:15 PM & 3:45 PM CET',
    position: { lat: 43.7712, lng: 11.2422 },
    color: '#047857',
    glyphColor: '#ecfdf5',
    borderColor: '#064e3b',
  },
];

const MarkerWithInfoWindow: React.FC<{
  landmark: LandmarkMarkerData;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}> = ({ landmark, isSelected, onSelect }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const handleMarkerClick = useCallback(() => {
    onSelect(isSelected ? null : landmark.id);
  }, [isSelected, landmark.id, onSelect]);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={landmark.position}
        title={landmark.title}
        onClick={handleMarkerClick}
      >
        <Pin
          background={landmark.color}
          borderColor={landmark.borderColor}
          glyphColor={landmark.glyphColor}
        />
      </AdvancedMarker>
      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelect(null)}>
          <div className="p-1 max-w-[220px] space-y-1">
            <h5 className="text-xs font-bold text-stone-900">{landmark.title}</h5>
            <p className="text-[11px] text-stone-600 leading-snug">{landmark.subtitle}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${landmark.position.lat},${landmark.position.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:underline pt-0.5"
            >
              <Navigation className="w-3 h-3" />
              <span>Directions in Google Maps</span>
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapLoadingOverlay: React.FC = () => {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100/95 p-4 text-center z-10">
        <MapPin className="w-6 h-6 text-rose-700 mb-2" />
        <p className="text-xs font-semibold text-stone-900">
          Interactive Google Map preview unavailable right now
        </p>
        <p className="text-[11px] text-stone-500 mt-1 max-w-xs">
          Villa La Selva Estate · Strada di Selva 14, Castelnuovo Berardenga (43.3486° N, 11.4921° E)
        </p>
      </div>
    );
  }
  return null;
};

export const VenueGoogleMap: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>('villa');
  const [focusCenter, setFocusCenter] = useState<{ lat: number; lng: number }>({
    lat: 43.3486,
    lng: 11.4921,
  });
  const [zoomLevel, setZoomLevel] = useState<number>(12);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <div className="space-y-2.5">
      {/* Quick Camera Jump Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {WEDDING_LANDMARKS.map((lm) => (
          <button
            key={lm.id}
            type="button"
            onClick={() => {
              setFocusCenter(lm.position);
              setZoomLevel(lm.id === 'shuttle' ? 10 : 14);
              setSelectedId(lm.id);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
              selectedId === lm.id
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {lm.title.split(' (')[0]}
          </button>
        ))}
      </div>

      {/* Explicit sized container (height: 360px) required for Google Map */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 h-[360px] w-full">
        <APIProvider
          apiKey={apiKey}
          libraries={['marker']}
          language="en"
          region="IT"
        >
          <MapLoadingOverlay />
          <GoogleMap
            mapId="DEMO_MAP_ID"
            center={focusCenter}
            zoom={zoomLevel}
            onCameraChanged={(ev) => {
              setFocusCenter(ev.detail.center);
              setZoomLevel(ev.detail.zoom);
            }}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '360px' }}
          >
            {WEDDING_LANDMARKS.map((landmark) => (
              <MarkerWithInfoWindow
                key={landmark.id}
                landmark={landmark}
                isSelected={selectedId === landmark.id}
                onSelect={setSelectedId}
              />
            ))}
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
};
