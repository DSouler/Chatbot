import React, { useState, useRef, useCallback } from 'react';
import { getChampionImage, getCostColor, getCostLabel } from '../data/championData';

/**
 * ChampionTooltip — hiển thị ảnh tướng TFT khi hover vào tên tướng
 * Tooltip hiện ngay phía trên tên tướng (position: absolute relative to wrapper).
 * Ảnh lấy từ MetaTFT (TFT Set 17), fallback Riot Data Dragon.
 */
const ChampionTooltip = ({ name, children }) => {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const timeoutRef = useRef(null);

  const champInfo = getChampionImage(name);
  if (!champInfo) return <>{children}</>;

  const { imageUrl, fallbackUrl, cost } = champInfo;
  const costColor = getCostColor(cost);

  // Dùng fallback nếu MetaTFT lỗi
  const displayUrl = imgError && fallbackUrl ? fallbackUrl : imageUrl;

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
      {/* Champion name text */}
      <span
        style={{
          color: costColor,
          fontWeight: 700,
          cursor: 'pointer',
          borderBottom: `2px dotted ${costColor}`,
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
            // Prevent inline collapsing
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
              padding: 8,
              border: `2.5px solid ${costColor}`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${costColor}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
              gap: 6,
              minWidth: 90,
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Champion portrait */}
            <span style={{
              display: 'block',
              width: 72,
              height: 72,
              borderRadius: 10,
              overflow: 'hidden',
              border: `2.5px solid ${costColor}`,
              boxShadow: `0 4px 12px ${costColor}40`,
              background: '#0a0a1a',
            }}>
              <img
                src={displayUrl}
                alt={name}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  if (!imgError && fallbackUrl) {
                    setImgError(true);
                    e.target.src = fallbackUrl;
                  } else {
                    e.target.style.display = 'none';
                  }
                }}
              />
            </span>

            {/* Champion name */}
            <span
              style={{
                display: 'block',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                textAlign: 'center',
                letterSpacing: 0.5,
                lineHeight: 1.2,
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {name}
            </span>

            {/* Cost badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 8px',
                borderRadius: 20,
                background: `${costColor}20`,
                border: `1px solid ${costColor}50`,
                fontSize: 10,
                fontWeight: 600,
                color: costColor,
                letterSpacing: 0.3,
              }}
            >
              {'💰'.repeat(cost)} {cost} Gold
            </span>
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
                borderTop: `8px solid ${costColor}`,
              }}
            />
          </span>
        </span>
      )}
    </span>
  );
};

export default ChampionTooltip;
