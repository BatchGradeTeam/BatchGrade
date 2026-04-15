type ButtonProps = {
  children: React.ReactNode
  onClick?: () => void
}

export function Interface_Button({ children, onClick }: ButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
    >
      {children}
    </button>
  )
}
