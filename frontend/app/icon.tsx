import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glowing orb effect */}
        <div
          style={{
            position: 'absolute',
            width: '24px',
            height: '24px',
            background: 'radial-gradient(circle, rgba(124,58,237,0.8) 0%, rgba(59,130,246,0.4) 50%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(2px)',
          }}
        />
        {/* T letter with gradient */}
        <span
          style={{
            fontSize: '22px',
            fontWeight: 'bold',
            background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 50%, #3b82f6 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 0 10px rgba(124,58,237,0.5)',
            zIndex: 1,
          }}
        >
          T
        </span>
        {/* Small accent dots */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '4px',
            height: '4px',
            background: '#22d3ee',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '5px',
            width: '3px',
            height: '3px',
            background: '#a78bfa',
            borderRadius: '50%',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
}
