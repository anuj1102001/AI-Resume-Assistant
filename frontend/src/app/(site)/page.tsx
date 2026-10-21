import { ArrowRight, Check, FileSearch, FileText, Lock, PenLine, Quote, ScanSearch, ShieldCheck, Sparkles, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CoverageRing, KindTag, StatusPill } from "@/components/ui";

export default function Landing() {
  return (
    <>
      <Hero />
      <Problem />
      <Steps />
      <Features />
      <Evidence />
      <MatchingPreview />
      <Methodology />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pt-16">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden /> AI resume assistant that shows its evidence
        </p>
        <h1 className="mt-6 font-display text-[42px] font-bold leading-[1.03] tracking-[-0.035em] sm:text-[56px] lg:text-[60px]">Your next opportunity starts with a stronger resume.</h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Understand your strengths, uncover skill gaps, and tailor your resume to the roles you actually want, with AI that explains its recommendations.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app#upload" className="btn-primary h-12 px-5 text-[15px]">
            Analyze my resume <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="#product" className="btn-secondary h-12 px-5 text-[15px]">
            Explore the product
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
          {["No account needed", "Every judgement quotes your resume", "Never adds experience you don't have"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-ok" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </div>
      <ProductPreview />
    </section>
  );
}

/** The interface as the hero visual: a scaled-down analysis workspace, drawn with the product's own components. */
function ProductPreview() {
  return (
    <figure className="relative" aria-label="Illustration of the analysis workspace with sample data">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-[radial-gradient(60%_60%_at_80%_10%,rgb(var(--accent)/0.14),transparent),radial-gradient(50%_50%_at_10%_100%,rgb(var(--mark)/0.45),transparent)]" />
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-lift">
        <div className="flex items-center gap-1.5 border-b border-line bg-paper px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="ml-3 truncate text-xs text-ink-3">Priya Raman vs Senior Backend Engineer</span>
        </div>
        <div className="grid sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* resume */}
          <div aria-hidden className="hidden border-r border-line bg-sunk/60 p-4 sm:block">
            <div className="rounded-md bg-white p-4 text-[9.5px] leading-[1.55] text-[#1d2030] shadow-page">
              <p className="text-[13px] font-semibold">Priya Raman</p>
              <p className="text-[#6b6f80]">Bengaluru · priya.raman@example.com</p>
              <p className="mt-2 font-semibold">Experience</p>
              <p>Senior Backend Engineer, Kestrel Payments</p>
              <p className="mt-1">
                • <span className="rounded-sm bg-[#D9F99D] px-0.5">Cut checkout API p95 latency from 620 ms to 380 ms by moving fraud scoring to an asynchronous Kafka consumer.</span>
              </p>
              <p>• Led the migration of 14 services to per-service PostgreSQL schemas.</p>
              <p>• Designed an idempotency layer for payment retries.</p>
              <p className="mt-2 font-semibold">Skills</p>
              <p>Go, Python, SQL · PostgreSQL, Kafka · Docker, Kubernetes, AWS</p>
            </div>
          </div>
          {/* analysis */}
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <CoverageRing coverage={0.74} size={64} label="Sample estimate: 74% requirement coverage" />
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent">Coverage estimate</p>
                <p className="text-sm font-semibold">5 of 7 required shown</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {["Go", "Kafka", "PostgreSQL"].map((s) => (
                <span key={s} className="rounded-full bg-ok-soft px-2 py-0.5 text-2xs font-medium text-ok">
                  {s}
                </span>
              ))}
              {["Java", "gRPC"].map((s) => (
                <span key={s} className="rounded-full border border-dashed border-line px-2 py-0.5 text-2xs text-ink-3">
                  {s} · not shown
                </span>
              ))}
            </div>
            <div className="rounded-tile border border-line p-3">
              <div className="flex items-center gap-2">
                <StatusPill status="met" />
                <span className="truncate text-xs font-medium">Event-driven systems</span>
              </div>
              <p className="mt-1.5 rounded-r-md border-l-[3px] border-mark-strong bg-mark/30 py-0.5 pl-2 text-[11px] text-ink-2">“moving fraud scoring to an asynchronous Kafka consumer”</p>
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok-soft px-1.5 py-px font-mono text-[10px] text-ok">
                <Check className="h-2.5 w-2.5" aria-hidden /> Experience · p. 1 · verified
              </p>
            </div>
            <div className="rounded-tile border border-accent/25 bg-accent-soft/50 p-3">
              <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-accent">
                <PenLine className="h-3 w-3" aria-hidden /> Suggested rewrite
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                <span className="text-ink-3 line-through">Cut</span> <span className="rounded-sm bg-ok-soft text-ok">Reduced</span> checkout API p95 latency from 620 ms to 380 ms by moving fraud scoring to an asynchronous Kafka consumer.
              </p>
              <p className="mt-1 text-[10.5px] text-ink-3">No new numbers or skills · keeps every original fact</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-ink-3">Illustration with sample data from a fictional resume.</figcaption>
    </figure>
  );
}

function SectionHead({ eyebrow, title, intro, id }: { eyebrow: string; title: string; intro?: string; id?: string }) {
  return (
    <div id={id} className="max-w-2xl scroll-mt-24">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-display text-[32px] font-bold leading-tight tracking-[-0.03em] sm:text-[38px]">{title}</h2>
      {intro && <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{intro}</p>}
    </div>
  );
}

function Problem() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
        <SectionHead
          id="product"
          eyebrow="The product"
          title="Resume tools tell you a number. Shortlist shows you why."
          intro="Most AI resume tools hand out confident scores nobody can check, and rewrite bullets with metrics you never achieved. That hurts you in the interview, where every line gets tested."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            [Quote, "Evidence, not verdicts", "Every judgement about your resume comes with the line it's based on, highlighted on the page. If the quote can't be found, the claim is flagged."],
            [ShieldCheck, "Your facts stay yours", "Suggested rewrites are checked for numbers and skills your resume doesn't contain. Anything new is flagged next to the suggestion, and you decide."],
            [ScanSearch, "Honest measures", "No made-up \"ATS score\". Readability checks explain what they found; job coverage is an estimate with its method shown."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof Quote;
            return (
              <div key={title as string} className="rounded-card border border-line bg-paper p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">
                  <I className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold">{title as string}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{body as string}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { icon: Upload, title: "Upload", body: "Drop a PDF or Word file. Shortlist reads its sections, roles, dates and contact details, and runs readability checks straight away, without AI.", tag: "Instant · no AI" },
    { icon: FileSearch, title: "Analyze", body: "See which skills your work demonstrates and which are only listed. Add a job ad to see each requirement as met, partly met or not shown, with quotes from both.", tag: "AI with citations" },
    { icon: PenLine, title: "Improve", body: "Rewrite bullets with three suggestions each, review the changes word by word, keep what's true, and export a clean Word version.", tag: "You stay in control" },
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
      <SectionHead id="how-it-works" eyebrow="How it works" title="Upload, analyze, improve." />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body, tag }, i) => (
          <li key={title} className="card relative p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-paper">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
            </div>
            <h3 className="mt-5 font-display text-[22px] font-bold tracking-[-0.02em]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            <p className="mt-4 inline-block rounded-full bg-sunk px-2.5 py-1 text-2xs font-medium text-ink-2">{tag}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  const items = [
    { src: "/product/match.png", title: "Job matching, requirement by requirement", body: "Coverage at the top, then every requirement judged with quotes from your resume. Required items are marked, and gaps come with a specific next step." },
    { src: "/product/assistant.png", title: "An assistant that cites both documents", body: "Ask about your fit for a role. Facts cite your resume or the job ad, comparisons are labelled as judgements, and every answer lists the passages it searched." },
    { src: "/product/tailor.png", title: "Rewrites that keep your facts", body: "Three versions per bullet, each with its reasoning. New numbers or skills are flagged, and questions suggest what would make it stronger." },
    { src: "/product/profile.png", title: "Skills you show, not just list", body: "Your profile separates skills your work demonstrates from skills you only list, so you know what a recruiter can actually see." },
    { src: "/product/review.png", title: "Readability checks with reasons", body: "Layout, headings, contact details, bullets, dates and more. Each check shows the lines involved, why it matters and what to do." },
  ];
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
        <SectionHead id="features" eyebrow="Features" title="A workspace built for reviewing, not just generating." intro="Real screenshots of the live product, with AI output from a fictional sample resume." />
        <div className="mt-12 space-y-16">
          {items.map((f, i) => (
            <div key={f.src} className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
              <div className={i % 2 ? "lg:order-2" : undefined}>
                <h3 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em]">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{f.body}</p>
              </div>
              <div className="overflow-hidden rounded-card border border-line shadow-lift">
                <Image src={f.src} alt={`Screenshot: ${f.title}`} width={2160} height={1350} sizes="(min-width: 1024px) 700px, 100vw" className="h-auto w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Evidence() {
  const flow = [
    ["The model cites", "Each claim names the resume passage it relies on and quotes it word for word."],
    ["The server checks", "The quote is normalised and searched for in that passage and the whole resume."],
    ["You see the status", "Verified quotes get a green chip and a highlight on the page; anything unverifiable is flagged in red."],
    ["Scores stay honest", "If the AI says a requirement is met but its quote can't be found, it's counted as partly met."],
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
      <SectionHead eyebrow="Explainable AI" title="How a recommendation earns your trust." intro="AI output is treated as a claim to check, not an answer to accept." />
      <ol className="mt-10 grid gap-3 md:grid-cols-4">
        {flow.map(([t, d], i) => (
          <li key={t} className="relative rounded-card border border-line bg-surface p-5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-ink">{i + 1}</span>
            <h3 className="mt-3 text-[15px] font-semibold">{t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Stated by your resume</p>
          <p className="mt-2 text-[15px]">Led the migration of 14 services to per-service PostgreSQL schemas.</p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok-soft px-2 py-0.5 font-mono text-2xs text-ok">
            <Check className="h-3 w-3" aria-hidden /> Experience · p. 1
          </p>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Shortlist&apos;s judgement</p>
          <p className="mt-2 text-[15px]">
            <span className="mr-1.5 rounded-full bg-accent-soft px-2 py-px text-2xs font-medium text-accent">Judgement</span>
            Operates at a senior level, leading migrations and designing reliability work.
          </p>
          <p className="mt-2 text-xs text-ink-3">Labelled as interpretation, so you never mistake it for a fact.</p>
        </div>
      </div>
    </section>
  );
}

function MatchingPreview() {
  const rows = [
    { status: "met", kind: "must", text: "4+ years building backend services", why: "“Backend engineer with four years building payment APIs”" },
    { status: "partial", kind: "must", text: "Kubernetes in a public cloud", why: "Listed under skills, but no bullet shows running it in production." },
    { status: "missing", kind: "must", text: "Strong in Java", why: "Not on the resume. Shortlist won't suggest adding it unless you have the experience." },
    { status: "met", kind: "nice", text: "Payments domain experience", why: "“Senior Backend Engineer, Kestrel Payments”" },
  ] as const;
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <SectionHead eyebrow="Resume-to-job matching" title="See exactly where you stand for a role." />
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Paste a job ad. Shortlist extracts its requirements, quoting the ad for each, then finds the most relevant parts of your resume for every requirement
            and judges it with evidence.
          </p>
          <div className="mt-6 rounded-card border border-line bg-paper p-5">
            <p className="text-sm font-semibold">About the coverage estimate</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Coverage is computed in code from the judgements: required items count double and partial evidence counts half. It measures what your resume shows
              against one ad. It is not a probability of an interview and not an ATS score.
            </p>
          </div>
        </div>
        <div className="card p-5" aria-label="Illustration of a match report with sample data">
          <div className="flex items-center gap-4 border-b border-line pb-4">
            <CoverageRing coverage={0.74} size={72} label="Sample estimate: 74% requirement coverage" />
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent">Senior Backend Engineer</p>
              <p className="font-display text-xl font-bold tracking-[-0.02em]">5 of 7 required shown</p>
              <p className="text-xs text-ink-3">Sample data · fictional resume</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li key={r.text} className="rounded-tile border border-line bg-paper/60 px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <StatusPill status={r.status} />
                  <span className="min-w-0 flex-1 text-sm font-semibold">{r.text}</span>
                  <KindTag kind={r.kind} />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{r.why}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Methodology() {
  const parts = [
    ["Reading your file", "Text is extracted page by page, with two-column layouts read in the right order. Sections, roles, dates and contact details are found by rules you can test, not by AI."],
    ["Finding the right evidence", "Resume sections are indexed with a small embedding model that runs on the server, combined with keyword search, so each requirement is matched to the most relevant lines."],
    ["Asking the model", "Google's Gemini returns structured answers that must cite passages. Prompts are versioned, and results are cached so the same question isn't paid for twice."],
    ["Checking the answer", "Quotes are verified against your resume, unverifiable claims are flagged, and rewrites are scanned for new numbers and skills before you see them."],
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
      <SectionHead
        id="methodology"
        eyebrow="Methodology"
        title="Technology you can inspect."
        intro="Built with Python and FastAPI, retrieval over your own resume, Gemini for language, and a Next.js interface. The code, tests and evaluation are public."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {parts.map(([t, d], i) => (
          <div key={t} className="flex gap-4 rounded-card border border-line bg-surface p-5">
            <span className="font-mono text-sm text-accent">0{i + 1}</span>
            <div>
              <h3 className="text-[15px] font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-card border border-line bg-surface p-5">
          <h3 className="text-[15px] font-semibold">Measured, with caveats</h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["1.0", "Section F1 when parsing six test resumes (v1: 0.73)"],
              ["0.905", "Accuracy judging 74 labelled requirements"],
              ["0.965", "F1 for finding supporting evidence"],
              ["0", "Missing requirements marked as met"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-[28px] font-bold tracking-[-0.02em]">{v}</dd>
                <dd className="mt-1 text-xs leading-snug text-ink-3">{l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            From a small synthetic test set written alongside the code, so these show progress on known cases rather than accuracy on unseen resumes.{" "}
            <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/anuj1102001/AI-Resume-Assistant/tree/main/backend/evals/results" target="_blank" rel="noreferrer">
              Full results
            </a>
          </p>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <Lock className="h-4 w-4 text-accent" aria-hidden /> Your data
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
            <li>No account. Your workspace is private to your browser and you can delete anything in it.</li>
            <li>AI requests include only the resume and job ad you&apos;re working on, never your other files.</li>
            <li>
              This demo uses Gemini&apos;s free tier, so avoid uploading anything you wouldn&apos;t share.{" "}
              <Link href="#privacy" className="underline underline-offset-2 hover:text-ink">
                Details
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-card bg-ink px-6 py-14 text-center text-paper sm:px-12">
        <span aria-hidden className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-accent/50 blur-3xl" />
        <span aria-hidden className="absolute -bottom-28 -right-10 h-64 w-64 rounded-full bg-mark/30 blur-3xl" />
        <FileText className="relative mx-auto h-8 w-8 text-mark" aria-hidden />
        <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-[32px] font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">See what your resume really shows.</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-paper/75">Upload a resume or try a sample. No sign-up, and nothing is analysed until you ask.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/app#upload" className="btn h-12 bg-paper px-5 text-[15px] text-ink hover:bg-paper/90">
            Analyze my resume <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/case-study" className="btn h-12 border border-paper/25 px-5 text-[15px] text-paper hover:bg-paper/10">
            Read the case study
          </Link>
        </div>
      </div>
    </section>
  );
}
