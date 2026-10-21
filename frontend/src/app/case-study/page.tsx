import Link from "next/link";

export const metadata = {
  title: "Case study",
  description: "How Shortlist rebuilds a resume chatbot into an honest career tool: generic parsing, explainable checks, evidence-based job matching and guarded rewrites.",
};

const V1_V2: [string, string, string][] = [
  ["Parsing", "Section rules tuned to one resume: the author's own job titles and a “GitHub Link 2” string", "Heading synonyms, wrapped bullets, roles from date ranges, two-column PDFs read column by column, DOCX"],
  ["ATS score", "0–100, including 10 points every resume got for “action verbs” that were never checked", "13 explainable checks with the exact lines involved and a fix; no single score"],
  ["Job match", "37 hard-coded keywords matched as substrings (“ai” matched inside “maintain”)", "Requirements extracted from the ad, judged one by one with resume quotes; scored in code"],
  ["Rewrites", "A generic review paragraph", "Three versions per bullet, checked for numbers and skills the original never mentioned"],
  ["State", "One global resume and chat history shared by every visitor", "Private workspaces; several resumes and jobs; tailored versions per job"],
  ["Reliability", "5 imported packages missing from requirements; README described a different model", "Clean install, 42 backend tests, CI, Docker; runs without a key"],
  ["Interface", "Streamlit tabs", "A resume viewer with evidence highlighted beside the analysis, on desktop and phone"],
];

export default function CaseStudy() {
  return (
    <article className="mx-auto max-w-[760px] px-4 pb-24 pt-12 sm:px-6">
      <p className="eyebrow">Case study · AI engineering and product design</p>
      <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.1] tracking-tight">Shortlist: show your real experience, clearly</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
        Shortlist began as a resume chatbot with an &ldquo;ATS score&rdquo;. Version 2 is a career tool built on one rule: it never helps you claim something your
        resume can&apos;t back up. It checks how your resume reads, matches it to a job requirement by requirement with quotes as evidence, and suggests rewrites
        that keep your facts.
      </p>
      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-card border border-line bg-surface p-5 text-sm sm:grid-cols-4">
        {[
          ["Role", "Product, design and engineering"],
          ["Stack", "Python, FastAPI, Gemini, Next.js"],
          ["Core", "Parser, checks, hybrid RAG, guardrails"],
          ["Status", "Working prototype; parsing and matching evals run"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1">{v}</dd>
          </div>
        ))}
      </dl>

      <Section n="01" title="The problem and who it's for">
        <p>
          Job seekers, especially early-career candidates and people changing fields, tailor a resume for every application without knowing what a recruiter or
          tracking system sees. Most AI resume tools make this worse: they produce confident scores no one can verify and rewrite bullets with metrics the candidate
          never achieved, which falls apart in the interview.
        </p>
        <Callout>
          <strong>Hypotheses, not findings.</strong> These pains come from desk research and conversations, not structured interviews. Section 10 describes the study
          that would test them.
        </Callout>
      </Section>

      <Section n="02" title="Vision and solution">
        <p>
          <strong>Make real experience easy to see.</strong> Shortlist explains instead of scoring, cites instead of asserting, and flags anything a rewrite adds.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Review:</strong> readability checks (columns, tables and photos, headings, contact details, bullet openers, numbers, unnecessary personal details).
          </li>
          <li>
            <strong>Profile:</strong> skills split into &ldquo;shown in your work&rdquo; and &ldquo;only listed&rdquo;, strongest achievements, and where the resume
            undersells you.
          </li>
          <li>
            <strong>Match:</strong> each requirement in a job ad, met / partly / not shown, with quotes from your resume and what to make visible.
          </li>
          <li>
            <strong>Tailor:</strong> rewrites aimed at the job, a word-level diff, and a clean single-column Word export.
          </li>
          <li>
            <strong>Ask:</strong> interview prep from your own resume, with the lines each answer relies on.
          </li>
        </ul>
      </Section>

      <Section n="03" title="What v1 did, and what changed">
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-sunk text-xs text-ink-2">
              <tr>
                <th className="px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">v1</th>
                <th className="px-3 py-2 font-medium">v2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {V1_V2.map(([k, a, b]) => (
                <tr key={k} className="align-top">
                  <th className="px-3 py-2 font-medium">{k}</th>
                  <td className="px-3 py-2 text-ink-2">{a}</td>
                  <td className="px-3 py-2">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-3">Every v1 issue above was confirmed by installing and running the original code.</p>
      </Section>

      <Section n="04" title="Architecture and technical decisions">
        <Diagram />
        <Decision title="Deterministic first, model second">
          Parsing, layout inspection, readability checks and the keyword view need no model: they&apos;re instant, free, testable and still work with AI switched off.
          The model is used where judgement is needed (is this experience equivalent?), on clean, located text the parser produced.
        </Decision>
        <Decision title="The score is computed in code, never by the model">
          Coverage weights required items double and gives half credit for partial evidence. If the model says &ldquo;met&rdquo; but its quote can&apos;t be found in
          the resume, the requirement is downgraded to partial and the UI says why.
        </Decision>
        <Decision title="Guardrails on rewrites">
          The prompt forbids new facts, and the server checks anyway: any number not in the original, or any skill that appears nowhere on the resume, is flagged
          next to the suggestion. Placeholders like [X]% are encouraged when a result is missing.
        </Decision>
        <Decision title="Retrieval per requirement">
          Each requirement retrieves its three most relevant resume passages (local bge-small embeddings + BM25, fused with RRF). The union, usually most of a short
          resume, goes to one model call that judges every requirement, which keeps cost to one call per match.
        </Decision>
        <Decision title="Shared core with Margin">
          Ingestion, hybrid retrieval, quote verification, workspace security and the LLM client are the same tested modules as my document tool Margin, adapted
          rather than rewritten.
        </Decision>
      </Section>

      <Section n="05" title="User journey and interface decisions">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Upload a resume (or a sample) and get the readability review straight away, with no AI wait.</li>
          <li>Paste a job ad; Shortlist lists its requirements, each linked to the line of the ad it came from.</li>
          <li>Open the match: coverage, required items met, then every requirement with its evidence. The instant keyword check shows while the AI works.</li>
          <li>Click a quote: the resume page scrolls and highlights it, so you see exactly what a recruiter would.</li>
          <li>Tailor bullets for this job, review the diff, and download a Word file.</li>
        </ol>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>No vanity score.</strong> The only number is coverage, labelled as what the resume shows against this ad, &ldquo;not a prediction of an interview
            or of any ATS ranking&rdquo;.
          </li>
          <li>
            <strong>Problems first.</strong> Required items and gaps lead; passes are folded away.
          </li>
          <li>
            <strong>Warnings beside the suggestion</strong>, not in a footnote: &ldquo;Adds 45, a number your original doesn&apos;t state&rdquo;.
          </li>
          <li>
            <strong>Same system as Margin</strong> (type, spacing, evidence colours, states) with its own green accent, so both read as one portfolio and as distinct
            products.
          </li>
          <li>Keyboard-operable everywhere, skip link, ARIA tabs and meters, light and dark, and a phone layout that switches between resume and insights.</li>
        </ul>
      </Section>

      <Section n="06" title="Evaluation">
        <p>
          Six synthetic resumes in deliberately different formats (including a two-column PDF and a Word file) and four job ads, with hand-labelled gold data. v1 is
          the original code from the main branch, run unchanged on the same files. No API key needed; both evals run in CI.
        </p>
        <Table
          caption="Parsing (6 resumes)"
          head={["Metric", "v1", "v2"]}
          rows={[
            ["Files parsed", "5/6 (no DOCX)", "6/6"],
            ["Section F1", "0.732", "1.0"],
            ["Name found", "0.5", "1.0"],
            ["Contact details found", "0.533", "1.0"],
            ["Roles extracted correctly", "not extracted", "6/6"],
          ]}
        />
        <Table
          caption="Requirement matching (74 requirements, 8 resume–job pairs)"
          head={["Metric", "v1 keywords", "v2 keywords", "v2 AI"]}
          rows={[
            ["Requirements it can assess", "0.5", "0.838", "1.0"],
            ["Accuracy (met / partial / missing)", "0.216", "0.622", "0.905"],
            ["Evidence detection F1", "0.174", "0.849", "0.965"],
            ["Over-claim rate", "0.0", "0.0", "0.0"],
          ]}
        />
        <p>
          <strong>Read with care:</strong> v2 was developed while looking at these files and the labels were written by the same person, so these numbers show the
          change from v1 on known cases, not accuracy on unseen resumes. Keyword methods can&apos;t judge requirements like &ldquo;a track record of improving
          latency&rdquo;, which is why the match itself uses retrieval and the model. The AI column comes from{" "}
          <code className="font-mono text-sm">evals/run_matching.py --llm</code>, run on 2026-10-21 with gemini-3.5-flash-lite: one call per resume–job pair, quotes
          verified, and an unverifiable &ldquo;met&rdquo; downgraded, exactly as in the product. It never marked a missing requirement as met.
        </p>
      </Section>

      <Section n="07" title="Challenges, iterations and trade-offs">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Two-column resumes.</strong> Sorted extraction merged the columns line by line and lost every section. Shortlist now finds the gutter and reads each
            column in turn, and still warns that some tracking systems won&apos;t.
          </li>
          <li>
            <strong>Names in capitals</strong> looked like section headings; an ALL-CAPS line before the first real section is now treated as the header.
          </li>
          <li>
            <strong>Wrapped bullets and URLs</strong> (&ldquo;github.com/&rdquo; at the end of a line) are rejoined before matching.
          </li>
          <li>
            <strong>&ldquo;React.js&rdquo; counted as JavaScript.</strong> A skill can no longer start right after a dot. Each fix came with a test.
          </li>
          <li>
            <strong>Trade-off:</strong> anonymous workspaces mean no sign-up but no recovery. Fine for a portfolio demo; a real product needs accounts.
          </li>
        </ul>
      </Section>

      <Section n="08" title="Testing and verified results">
        <ul className="list-disc space-y-1 pl-5">
          <li>42 backend tests (pytest), with a fake model that can also misbehave on purpose: invented evidence gets downgraded, inflated rewrites get flagged.</li>
          <li>Gold-label parsing tests for each of the six resume formats.</li>
          <li>13 frontend unit tests (Vitest), typecheck and lint.</li>
          <li>A scripted browser walkthrough of every screen at 1440 px and 390 px in light and dark: no console errors, no horizontal scroll.</li>
        </ul>
      </Section>

      <Section n="09" title="Demo">
        <p>
          Start from the{" "}
          <Link href="/" className="underline underline-offset-2">
            dashboard
          </Link>{" "}
          with a sample resume and job. The live demo runs gemini-3.5-flash-lite on free hosting, so the first visit after a quiet spell takes up to a minute to wake the server.
        </p>
      </Section>

      <Section n="10" title="What's next, and what I learned">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Usability study (planned, not done):</strong> 6 job seekers each tailor their own resume for a real ad, think-aloud, 30 minutes. Measure whether they
            understand why a requirement is &ldquo;partly&rdquo; met, how often they accept, edit or reject rewrites, and whether flagged additions change what they keep.
          </li>
          <li>A held-out set of real, consented resumes labelled by someone else; run the AI match eval and compare models.</li>
          <li>Cover-letter drafting from the same evidence, and accounts with version history.</li>
          <li>
            <strong>Lesson:</strong> the most valuable AI behaviour here is restraint. Showing a candidate what their resume already proves, and refusing to invent the
            rest, is more useful than any score.
          </li>
        </ul>
      </Section>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <p className="font-mono text-2xs text-ink-3">{n}</p>
      <h2 className="mt-1 font-serif text-[26px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[16px] leading-relaxed">{children}</div>
    </section>
  );
}

function Decision({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-ink-2">{children}</p>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border-l-4 border-mark bg-sunk px-4 py-3 text-sm text-ink-2">{children}</p>;
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[440px] text-right text-sm">
        <caption className="bg-sunk px-3 py-2 text-left text-xs font-medium text-ink-2">{caption}</caption>
        <thead className="text-xs text-ink-3">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i ? "px-3 py-2 font-medium" : "px-3 py-2 text-left font-medium"}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-surface font-mono">
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className={i ? "px-3 py-2" : "px-3 py-2 text-left font-sans"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Diagram() {
  const box = "rounded-lg border border-line bg-surface px-3 py-2 text-center text-xs";
  const arrow = <span className="text-center text-ink-3" aria-hidden>↓</span>;
  return (
    <figure className="rounded-card border border-line bg-sunk/60 p-4" aria-label="Architecture diagram">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">On upload (no AI)</p>
          <div className={box}>PDF / DOCX · type from bytes · 5 MB, 8 pages</div>
          {arrow}
          <div className={box}>Column-aware text · layout facts (columns, tables, images)</div>
          {arrow}
          <div className={box}>Sections · bullets · roles and dates · contact</div>
          {arrow}
          <div className={box}>13 readability checks · section chunks + local embeddings</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">On match (one AI call)</p>
          <div className={box}>Job ad → cited requirements (once per job)</div>
          {arrow}
          <div className={box}>Per requirement: top-3 resume passages (dense + BM25, RRF)</div>
          {arrow}
          <div className={box}>Gemini judges each requirement with quotes</div>
          {arrow}
          <div className={box}>Quotes verified · unverifiable &ldquo;met&rdquo; downgraded · score in code</div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-ink-3">FastAPI backend (Docker), Next.js frontend, SQLite, workspace tokens, per-workspace hourly AI limit, results cached.</figcaption>
    </figure>
  );
}
