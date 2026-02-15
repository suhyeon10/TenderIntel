import { useEffect, useState } from 'react'

const useHydration = () => {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])
  return isMounted
}

export default useHydration
