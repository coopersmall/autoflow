'use client';

import { LayoutProvider } from '@web/components/context/LayoutContext.tsx';
import Home from '@web/components/pages/Home.tsx';
import { CookiesProvider } from 'react-cookie';
import './App.css';

function Root() {
  return <Home />;
}

export function App() {
  return (
    <CookiesProvider>
      <LayoutProvider>
        <Root />
      </LayoutProvider>
    </CookiesProvider>
  );
}

export default App;
