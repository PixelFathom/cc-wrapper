import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Tediux - AI-Powered Development Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #0f0f23 100%)',
        }}
      >
        {/* Background decorations */}
        <div
          style={{
            position: 'absolute',
            top: '50px',
            left: '50px',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            right: '50px',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
            borderRadius: '24px',
            marginBottom: '40px',
            boxShadow: '0 20px 40px rgba(124, 58, 237, 0.3)',
          }}
        >
          <span
            style={{
              fontSize: '70px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            T
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #ffffff 0%, #a78bfa 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: '20px',
          }}
        >
          Tediux
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '32px',
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          AI-Powered Development Platform
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            marginTop: '50px',
          }}
        >
          {['AI Queries', 'Deployments', 'Cloud Hosting'].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '24px',
                color: '#d4d4d8',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  background: '#7c3aed',
                  borderRadius: '50%',
                }}
              />
              {feature}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
