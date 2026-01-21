export const runtime = 'edge';

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import SurveyLinkPanel from "./SurveyLinkPanel";
import SupplierMappingPanel from "./SupplierMappingPanel";
import PrescreenPanel from "./PrescreenPanel";
import SupplierMappedSummary from "./SupplierMappedSummary"; // ✅ new import
import ProjectStatusControl from "./ProjectStatusControl";

/* helpers */
function fmt(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(d);
}
function dateStr(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

/** Redirect links host */
const THANKS_HOST = "https://opinion-elite.com";
function buildThanksUrl(authCode: number) {
  return `${THANKS_HOST}/Thanks/Index?auth=${authCode}&rid=[pid]`;
}

export default async function ProjectDetail({


  // In Next 15 RSC, this is a Promise and must be awaited.
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string }>;
}) {
  const prisma = getPrisma();
  const sp = await searchParams;
  const projectId = (sp.id ?? "").trim();
  const tab = (sp.tab ?? "detail").toLowerCase();
  

  if (!projectId) return redirect("/projects");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true, group: true },
  });
  if (!project) return notFound();

  const {
    code,
    name,
    category,
    loi,
    ir,
    startDate,
    endDate,
    currency,
    description,
    client,
    countryCode,
    languageCode,
    sampleSize,
    projectCpi,
    supplierCpi,
    preScreen,
    exclude,
    geoLocation,
    dynamicThanksUrl,
    uniqueIp,
    uniqueIpDepth,
    tSign,
    speeder,
    speederDepth,
    mobile,
    tablet,
    desktop,
    status,
  } = project;

  const Tab = ({
    href,
    active,
    children,
    color = active ? "bg-emerald-600" : "bg-slate-900",
  }: {
    href: string;
    active: boolean;
    children: React.ReactNode;
    color?: string;
  }) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm text-white ${color} ${active ? "" : "text-white/80"}`}
      prefetch={false}
    >
      {children}
    </Link>
  );

  const qid = encodeURIComponent(projectId);
  const preScreenstatus: "ACTIVE" | "CLOSED" =
  status === "CLOSED" ? "CLOSED" : "ACTIVE";

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="space-y-2">
  {/* HEADER ROW 1 */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Link
      href="/projects/new/projectlist"
      className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
    >
      ← Back
    </Link>
    <div className="text-lg font-semibold">
      {code} : {name}
    </div>
  </div>

  {/* Status dot + project info (RIGHT) */}
  <div className="flex items-center gap-2">
    <span
      className={`h-3 w-3 rounded-full ${
        status === "CLOSED" ? "bg-red-500" : "bg-emerald-500"
      }`}
    />
    <span className="text-sm font-semibold text-slate-800">
      {code} : {name}
    </span>
  </div>
</div>

{/* HEADER ROW 2 */}
<div className="flex items-center justify-between">
  {/* Tabs LEFT */}
  <div className="flex gap-2">
    <Tab href={`/projects/projectdetail?id=${qid}&tab=detail`} active={tab === "detail"} color="bg-emerald-600">
      Project Detail
    </Tab>
    <Tab href={`/projects/projectdetail?id=${qid}&tab=survey`} active={tab === "survey"}>
      Survey Link
    </Tab>
    <Tab href={`/projects/projectdetail?id=${qid}&tab=supplier`} active={tab === "supplier"}>
      Supplier Mapping
    </Tab>
    {preScreen && (
      <Tab href={`/projects/projectdetail?id=${qid}&tab=prescreen`} active={tab === "prescreen"}>
        Prescreen
      </Tab>
    )}
  </div>

  {/* Dropdown + Update RIGHT */}
  {tab !== "prescreen" && (
  <ProjectStatusControl
    projectId={projectId}
    initialStatus={preScreenstatus}
  />
  )}
</div>
      </div>
      {/* content by tab */}
      {tab === "survey" ? (
        <SurveyLinkPanel projectId={projectId} />
      ) : tab === "supplier" ? (
        <SupplierMappingPanel projectId={projectId} />
      ) : tab === "prescreen" ? (
        <PrescreenPanel projectId={projectId} initialStatus={preScreenstatus} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-end">
            <Link
              href={`/projects/edit/single?id=${qid}`}
              className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Edit
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-10">
            <Row l="Project Code" r={code} />
            <Row l="Client Code" r={client?.code || "—"} />
            <Row l="Project Name" r={name} />
            <Row l="Client Name" r={client?.name || "—"} />
            <Row l="Project Category" r={category} />
            <Row l="Country" r={countryCode} />
            <Row l="LOI (Min)" r={String(loi)} />
            <Row l="Language" r={languageCode} />
            <Row l="IR (%)" r={fmt(ir)} />
            <Row l="Sample Size" r={String(sampleSize)} />
            <Row l="Start Date" r={dateStr(startDate)} />
            <Row l="End Date" r={dateStr(endDate)} />
            <Row l="Project CPI" r={fmt(Number(projectCpi))} />
            <Row l="Currency" r={currency} />
            <Row l="Supplier CPI" r={fmt(Number(supplierCpi))} />
          </div>

          <div className="mt-6">
            <div className="mb-1 font-medium">Description</div>
            <div className="rounded-md border border-slate-200 p-3 text-sm">{description || "—"}</div>
          </div>

          <div className="mt-6 grid gap-6">
            <div>
              <div className="mb-2 text-base font-semibold">Project Filter</div>
              <Toggles
                items={[
                  ["Prescreen", preScreen],
                  ["Geo Location", geoLocation],
                  ["Unique IP", uniqueIp ? `Yes${uniqueIpDepth ? `: ${uniqueIpDepth}` : ""}` : "No"],
                  ["Exclude", exclude],
                  ["Dynamic Thanks Url", dynamicThanksUrl],
                  ["TSign", tSign],
                  ["Speeder", speeder ? `Yes${speederDepth ? `: ${speederDepth}` : ""}` : "No"],
                ]}
              />
            </div>

            <div>
              <div className="mb-2 text-base font-semibold">Device Filter</div>
              <Toggles items={[["Mobile Study", mobile], ["Tablet Study", tablet], ["Desktop Study", desktop]]} />
            </div>
          </div>

          {/* Supplier Mapped between Device Filter and Redirect Links */}
          <SupplierMappedSummary projectId={projectId} />

          {/* Redirect Links */}
          <div className="mt-8">
            <div className="mb-2 text-base font-semibold">Redirect Links</div>
            <div className="grid gap-3 text-sm">
              <RedirectRow label="Complete Status" href={buildThanksUrl(10)} />
              <RedirectRow label="Terminate Status" href={buildThanksUrl(20)} />
              <RedirectRow label="Over Quota Status" href={buildThanksUrl(40)} />
              <RedirectRow label="Quality Term Status" href={buildThanksUrl(30)} />
              <RedirectRow label="Survey Close Status" href={buildThanksUrl(70)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ l, r }: { l: string; r: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] text-sm">
      <div className="text-slate-500">{l}</div>
      <div> : {r}</div>
    </div>
  );
}

function Toggles({ items }: { items: [string, any][] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!v && v !== "No"} readOnly />
          <span>
            {k}
            {typeof v === "string" ? ` — ${v}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function RedirectRow({ label, href }: { label: string; href: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-2">
      <div className="text-slate-600">{label}</div>
      <div className="flex items-center gap-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-emerald-700 hover:underline"
          title={href}
        >
          {href}
        </a>
      </div>
    </div>
  );
}