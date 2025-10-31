// FILE: src/app/projects/page.tsx
// Minimal wrapper to use the ProjectList component as the route page
export const runtime = 'edge';

import ProjectList from "../../ProjectList";
export default function Page() { return <ProjectList />; }