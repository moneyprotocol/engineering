export const InfoIcon = ({ color }: { color?: string }) => (
  <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20 36.6666C29.2047 36.6666 36.6666 29.2047 36.6666 20C36.6666 10.7952 29.2047 3.33331 20 3.33331C10.7952 3.33331 3.33331 10.7952 3.33331 20C3.33331 29.2047 10.7952 36.6666 20 36.6666Z"
      stroke={color ?? "#6100FF"}
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M20 13.3333V20"
      stroke={color ?? "#6100FF"}
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M20 26.6667H20.0167"
      stroke={color ?? "#6100FF"}
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
)
