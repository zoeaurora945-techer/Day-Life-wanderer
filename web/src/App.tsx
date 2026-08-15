/**
 * @file App root.
 * @description Sets up HashRouter and renders the Home page directly.
 * Access gate removed per project decision: fully open access for user acquisition.
 */

import type { FC } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import HomePage from './pages/Home'

/**
 * @description Root application component with routing.
 */
const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </HashRouter>
  )
}

export default App