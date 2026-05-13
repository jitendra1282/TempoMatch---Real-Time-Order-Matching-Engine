// Socket.io-client connection manager

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

let sharedSocket = null // singleton across re-renders

export default function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!sharedSocket) {
      sharedSocket = io(BACKEND_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      })
    }
    socketRef.current = sharedSocket

    const onConnect = () => {
      console.log('[WS] Connected:', sharedSocket.id)
      setConnected(true)
    }
    const onDisconnect = () => {
      console.log('[WS] Disconnected')
      setConnected(false)
    }

    sharedSocket.on('connect', onConnect)
    sharedSocket.on('disconnect', onDisconnect)

    // Sync initial connected state
    setConnected(sharedSocket.connected)

    return () => {
      sharedSocket.off('connect', onConnect)
      sharedSocket.off('disconnect', onDisconnect)
    }
  }, [])

  return { socket: socketRef.current, connected }
}
