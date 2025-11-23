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
          background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
          borderRadius: '6px',
        }}
      >
        <span
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'white',
          }}
        >
          T
        </span>
      </div>
    ),
    {
      ...size,
    }
  )
}
