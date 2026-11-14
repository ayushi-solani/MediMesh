import './globals.css';

export const metadata = {
  title: 'MediMesh | Regional Healthcare Resource Grid',
  description: 'Coordinate medicine batches, medical equipment, and resource transfers across participating facilities.'
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
