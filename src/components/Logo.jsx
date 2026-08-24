export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="5,5 55,50 5,95" fill="#2fae52" />
      <polygon points="55,5 80,28 55,50" fill="#29a8e0" />
      <polygon points="80,28 98,50 80,72" fill="#f7941d" />
      <polygon points="55,95 80,72 55,50" fill="#c63663" />
      <polygon points="55,50 80,28 80,72" fill="#7d4198" />
    </svg>
  )
}
