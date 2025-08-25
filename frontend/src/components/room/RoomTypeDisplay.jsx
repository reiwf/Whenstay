import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useRoomTypeTranslations from '../../hooks/useRoomTypeTranslations';

const RoomTypeDisplay = ({ roomType, showAll = false }) => {
  const { i18n } = useTranslation();
  const { loadRoomTypeTranslations, getCachedTranslation } = useRoomTypeTranslations();
  const [translatedFields, setTranslatedFields] = useState({});
  const [loading, setLoading] = useState(false);

  const currentLanguage = i18n.language || 'en';

  useEffect(() => {
    if (roomType?.id) {
      setLoading(true);
      loadRoomTypeTranslations(roomType.id, currentLanguage)
        .then(fields => {
          setTranslatedFields(fields);
        })
        .catch(error => {
          console.error('Error loading room type translations:', error);
          // Fallback to original values
          setTranslatedFields({
            name: roomType.name,
            description: roomType.description,
            bed_configuration: roomType.bed_configuration
          });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [roomType?.id, currentLanguage, loadRoomTypeTranslations]);

  if (loading) {
    return <div className="animate-pulse">Loading translations...</div>;
  }

  if (!roomType) {
    return null;
  }

  // Get translated text with fallback to original
  const getTranslatedText = (fieldName) => {
    const cached = getCachedTranslation(roomType.id, currentLanguage, fieldName);
    if (cached) return cached;
    
    const fromState = translatedFields[fieldName];
    if (fromState) return fromState;
    
    // Final fallback to original roomType data
    return roomType[fieldName] || '';
  };

  const translatedName = getTranslatedText('name');
  const translatedDescription = getTranslatedText('description');
  const translatedBedConfig = getTranslatedText('bed_configuration');

  if (!showAll) {
    // Simple display - just the name
    return (
      <span className="room-type-name" title={translatedDescription}>
        {translatedName}
      </span>
    );
  }

  // Detailed display
  return (
    <div className="room-type-display space-y-2">
      <h3 className="text-lg font-semibold text-gray-900">
        {translatedName}
      </h3>
      
      {translatedDescription && (
        <p className="text-sm text-gray-600">
          {translatedDescription}
        </p>
      )}
      
      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
        {roomType.max_guests && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0H21a3.375 3.375 0 00-3.375-3.375M10.5 6.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            {roomType.max_guests} guests
          </span>
        )}
        
        {translatedBedConfig && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {translatedBedConfig}
          </span>
        )}
        
        {roomType.room_size_sqm && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {roomType.room_size_sqm} m²
          </span>
        )}
      </div>
    </div>
  );
};

export default RoomTypeDisplay;
