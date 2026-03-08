import { createBrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './HomePage';
import MetronomePage from '../features/metronome/MetronomePage';
import ChordCheatSheet from '../features/chords/ChordCheatSheet';
import TwoFiveOnePage from '../features/two-five-one/TwoFiveOnePage';
import JazzHanonPage from '../features/jazz-hanon/JazzHanonPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'metronome', element: <MetronomePage /> },
      { path: 'chords', element: <ChordCheatSheet /> },
      { path: 'two-five-one', element: <TwoFiveOnePage /> },
      { path: 'jazz-hanon', element: <JazzHanonPage /> },
    ],
  },
]);
