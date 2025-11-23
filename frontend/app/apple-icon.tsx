import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: '40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Large glowing orb */}
        <div
          style={{
            position: 'absolute',
            width: '140px',
            height: '140px',
            background: 'radial-gradient(circle, rgba(124,58,237,0.6) 0%, rgba(59,130,246,0.3) 40%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        {/* Secondary glow */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            background: 'radial-gradient(circle, rgba(34,211,238,0.4) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        {/* T letter */}
        <span
          style={{
            fontSize: '110px',
            fontWeight: 'bold',
            background: 'linear-gradient(180deg, #ffffff 0%, #a78bfa 40%, #7c3aed 70%, #3b82f6 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            zIndex: 1,
          }}
        >
          T
        </span>
        {/* Accent dots - circuit-like pattern */}
        <div
          style={{
            position: 'absolute',
            top: '25px',
            right: '25px',
            width: '12px',
            height: '12px',
            background: '#22d3ee',
            borderRadius: '50%',
            boxShadow: '0 0 15px rgba(34,211,238,0.8)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '35px',
            left: '30px',
            width: '10px',
            height: '10px',
            background: '#a78bfa',
            borderRadius: '50%',
            boxShadow: '0 0 12px rgba(167,139,250,0.8)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50px',
            left: '25px',
            width: '6px',
            height: '6px',
            background: '#f472b6',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '35px',
            width: '8px',
            height: '8px',
            background: '#34d399',
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
