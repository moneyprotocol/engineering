interface EmptyMessageProps {
  title: string
  message: string
}

export const EmptyMessage = ({ title, message }: EmptyMessageProps) => {
  return (
    <div style={{ paddingBottom: "24px", paddingTop: "14px" }}>
      <div style={{ textAlign: "center", fontWeight: "500", fontSize: "20px" }}>{title}</div>
      <div style={{ textAlign: "center", fontSize: "13px", paddingTop: "4px" }}>{message}</div>
    </div>
  )
}
