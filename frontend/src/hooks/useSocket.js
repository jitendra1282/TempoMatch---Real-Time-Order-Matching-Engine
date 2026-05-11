// Socket.io-client connection manager
// Will be wired up when backend is ready

import { useEffect, useRef } from 'react'

export default function useSocket(url = 'http://localhost:3001') {
  const socketRef = useRef(null)

  useEffect(() => {
    // Socket connection will be established when backend is built
    // import { io } from 'socket.io-client'
    // socketRef.current = io(url)
    // return () => socketRef.current?.disconnect()
  }, [url])

  return socketRef.current
}
