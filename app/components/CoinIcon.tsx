export default function CoinIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/coin.svg"
      alt="coin"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ imageRendering: 'crisp-edges' }}
    />
  )
}
