import Link from "next/link";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    subtitle: "Try the workflow",
    features: ["5 generations / month", "One-click export", "Basic analytics"],
  },
  {
    name: "Pro",
    price: "$19",
    subtitle: "For active builders",
    features: [
      "200 generations / month",
      "LinkedIn direct posting",
      "Priority generation queue",
    ],
    highlighted: true,
  },
  {
    name: "Team",
    price: "$49",
    subtitle: "For small teams",
    features: [
      "Unlimited generations",
      "Shared workspace",
      "Referral & performance reports",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] p-6">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Pricing</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Choose a plan that matches your posting frequency.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`rounded-2xl border bg-white p-6 shadow-sm ${
                tier.highlighted
                  ? "border-[var(--primary)] ring-2 ring-blue-100"
                  : "border-slate-200"
              }`}
            >
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{tier.name}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{tier.subtitle}</p>
              <p className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
                {tier.price}
                <span className="text-base font-medium text-[var(--text-muted)]"> /mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                {tier.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <button className="mt-6 w-full rounded-full bg-[var(--text-primary)] py-2.5 text-sm font-semibold text-white">
                Choose {tier.name}
              </button>
            </article>
          ))}
        </div>
        <Link
          href="/"
          className="mt-8 inline-block text-sm font-semibold text-[var(--primary)] hover:underline"
        >
          ← Back to app
        </Link>
      </div>
    </main>
  );
}
