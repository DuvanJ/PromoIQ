// ============================================================
// useMediaQuery.js
// Hook mínimo para decisiones de layout que CSS solo no puede
// resolver — por ejemplo, convertir el sidebar en un drawer con
// botón hamburguesa en vez de solo encogerlo. Para todo lo demás
// (grillas, tablas, tipografía) preferir las clases utilitarias
// de GlobalStyles.css: no agregan re-renders de React.
//
// Uso:
//   import { useMediaQuery } from '../hooks/useMediaQuery';
//   import { breakpoints } from '../styles/breakpoints';
//   const esMobile = useMediaQuery(`(max-width: ${breakpoints.lg - 1}px)`);
// ============================================================

import { useState, useEffect } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const listener = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export default useMediaQuery;
