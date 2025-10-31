// FILE: src/app/page.tsx
export const runtime = 'edge';
export const preferredRegion = 'auto';

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login'); // or '/dashboard' or '/Survey'
}