export const templates = [
  {
    id: "blank",
    label: "Blank Document",
    imageUrl: "/blank-document.svg",
    initialContent: "<p></p>",
  },
  {
    id: "ai-features-guide",
    label: "AI Features Quickstart",
    imageUrl: "/ai-features.svg",
    initialContent: `
      <h1>Lekha AI Features Guide</h1>
      <p>This document explains the built-in AI workflows available in Lekha.</p>

      <h2>1. Content Generation</h2>
      <p>Use <strong>/lekha</strong> followed by a prompt to generate text directly inside the editor.</p>
      <p>Example: <code>/lekha write a one-page product launch brief</code></p>

      <h2>2. Diagram Generation</h2>
      <p>Use <strong>/chart</strong> or <strong>/mermaid</strong> to create Mermaid flowcharts/process diagrams.</p>
      <p>Example: <code>/chart onboarding flow for new users</code></p>

      <h2>3. CSV Data Visualization</h2>
      <p>Upload CSV data and use <strong>/viz</strong> to generate dashboards and charts.</p>
      <p>Examples:</p>
      <ul>
        <li><code>/viz monthly revenue by region</code></li>
        <li><code>/viz @sales.csv compare product categories by total sales</code></li>
      </ul>

      <h2>4. AI Task Planning</h2>
      <p>Create task-list items by typing open and close square brackets <code>[]</code>, then press Enter. Lekha generates an actionable plan for that task.</p>
      <p>Use the sparkles icon to open the plan panel and review steps.</p>

      <h2>5. Web Search</h2>
      <p>Use <strong>/search</strong> to fetch a concise answer with top web results.</p>
      <p>Example: <code>/search latest trends in customer support automation</code></p>
      <p><em>Note: Search can be slower right now. We are working on future optimizations.</em></p>

      <h2>Tips</h2>
      <ul>
        <li>Be specific with prompts to improve output quality.</li>
        <li>Use <code>@filename.csv</code> when you want viz to target one dataset.</li>
        <li>Switch inference provider from the top-right selector when needed.</li>
      </ul>
    `,
  },

  // Temporarily disabled templates:
  // {
  //   id: "software-proposal",
  //   label: "Software development proposal",
  //   imageUrl: "/software-proposal.svg",
  //   initialContent: `...`,
  // },
  // {
  //   id: "project-proposal",
  //   label: "Project proposal",
  //   imageUrl: "/project-proposal.svg",
  //   initialContent: `...`,
  // },
  // {
  //   id: "business-letter",
  //   label: "Business Letter",
  //   imageUrl: "/business-letter.svg",
  //   initialContent: `...`,
  // },
  // {
  //   id: "resume",
  //   label: "Resume",
  //   imageUrl: "/resume.svg",
  //   initialContent: `...`,
  // },
  // {
  //   id: "cover-letter",
  //   label: "Cover letter",
  //   imageUrl: "/cover-letter.svg",
  //   initialContent: `...`,
  // },
  // {
  //   id: "letter",
  //   label: "Letter",
  //   imageUrl: "/letter.svg",
  //   initialContent: `...`,
  // },
];
