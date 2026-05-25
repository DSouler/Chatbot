import React, { useState, useRef, useCallback } from 'react';
import { getItemImage } from '../data/itemData';

/**
 * ItemTooltip — hiển thị ảnh trang bị TFT khi hover vào tên item
 * Giống ChampionTooltip: tooltip hiện ngay phía trên tên item.
 * Ảnh lấy từ Riot Data Dragon CDN.
 */
const ItemTooltip = ({ name, children }) => {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const timeoutRef = useRef(null);

  const itemInfo = getItemImage(name);
  if (!itemInfo) return <>{children}</>;

  const { imageUrl, typeColor, typeLabel, recipe } = itemInfo;

  const handleMouseEnter = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(false), 150);
  }, []);

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Item name text */}
      <span
        style={{
          color: typeColor,
          fontWeight: 700,
          cursor: 'pointer',
          borderBottom: `2px dotted ${typeColor}`,
          transition: 'all 0.2s ease',
        }}
      >
        {children}
      </span>

      {/* Tooltip — positioned absolute, anchored above the name */}
      {visible && (
        <span
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            zIndex: 99999,
            pointerEvents: 'auto',
            animation: 'championTooltipFadeIn 0.2s ease-out',
            display: 'block',
            width: 'max-content',
          }}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={handleMouseLeave}
        >
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'linear-gradient(145deg, #0f0f23, #1a1a2e)',
              borderRadius: 14,
              padding: 10,
              border: `2.5px solid ${typeColor}`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${typeColor}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
              gap: 6,
              minWidth: 100,
              maxWidth: 180,
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Item icon */}
            <span style={{
              display: 'block',
              width: 56,
              height: 56,
              borderRadius: 8,
              overflow: 'hidden',
              border: `2.5px solid ${typeColor}`,
              boxShadow: `0 4px 12px ${typeColor}40`,
              background: '#0a0a1a',
            }}>
              <img
                src={imageUrl}
                alt={name}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  if (!imgError) {
                    setImgError(true);
                    e.target.style.display = 'none';
                  }
                }}
              />
            </span>

            {/* Item name */}
            <span
              style={{
                display: 'block',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                textAlign: 'center',
                letterSpacing: 0.3,
                lineHeight: 1.3,
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {name}
            </span>

            {/* Type badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 8px',
                borderRadius: 20,
                background: `${typeColor}20`,
                border: `1px solid ${typeColor}50`,
                fontSize: 9,
                fontWeight: 600,
                color: typeColor,
                letterSpacing: 0.3,
              }}
            >
              {typeLabel}
            </span>

            {/* Recipe */}
            {recipe && recipe.length === 2 && (
              <span
                style={{
                  display: 'block',
                  color: '#9ca3af',
                  fontSize: 9,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  marginTop: 2,
                }}
              >
                {recipe[0]} + {recipe[1]}
              </span>
            )}
          </span>

          {/* Arrow pointing down */}
          <span style={{ display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                display: 'block',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${typeColor}`,
              }}
            />
          </span>
        </span>
      )}
    </span>
  );
};

export default ItemTooltip;
