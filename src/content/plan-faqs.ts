export type Faq = { q: string; a: string };

const SHARED: Faq[] = [
  {
    q: "Is there a free trial?",
    a: "Yes. Every plan starts with a 14-day free trial. You add a card at checkout, but nothing is charged until the trial ends.",
  },
  {
    q: "Can I cancel during the trial?",
    a: "Yes. Cancel any time before day 14 and you pay nothing.",
  },
  {
    q: "How am I billed?",
    a: "Plans are billed monthly to the card you add at checkout. Payments are handled securely by our payment provider, Paddle.",
  },
  {
    q: "What happens if I change plans later?",
    a: "Open the plan you want and press Upgrade or Switch. The change happens right away using the card on file. On a paid plan you pay only the difference for the rest of the month; during a trial nothing is charged until the trial ends.",
  },
];

export const PLAN_FAQS: Record<string, Faq[]> = {
  soloist_monthly: [
    {
      q: "Who is The Soloist plan for?",
      a: "One-chair shops and solo operators who need every call answered and booked while they work.",
    },
    {
      q: "Is there a call limit?",
      a: "The Soloist is sized for up to 100 calls a month. If you're regularly busier than that, Professional Shop includes unlimited calls and DMs.",
    },
    {
      q: "Does it answer Instagram or Facebook messages?",
      a: "Not on this plan. Instagram and Facebook replies start on Professional Shop.",
    },
    ...SHARED,
  ],
  professional_monthly: [
    {
      q: "Who is Professional Shop for?",
      a: "Busy local businesses with a team, where customers reach you by phone, Instagram and Facebook.",
    },
    {
      q: "What do I get over The Soloist?",
      a: "Unlimited calls and DMs, Instagram and Facebook replies, a custom knowledge base, priority appointment logic and outbound reminders.",
    },
    {
      q: "Can it handle more than one location?",
      a: "Professional Shop is built for one location. Multiple calendars and team routing across shops come with Multi-Location.",
    },
    ...SHARED,
  ],
  multi_location_monthly: [
    {
      q: "Who is Multi-Location for?",
      a: "Owners running more than one shop who want every location handled from one place.",
    },
    {
      q: "What do I get over Professional Shop?",
      a: "Multiple calendars, automatic routing to the right team and location, a centralized dashboard and a dedicated account rep.",
    },
    {
      q: "Is everything in Professional included?",
      a: "Yes. Unlimited calls and DMs, Instagram and Facebook replies and reminders are all included.",
    },
    ...SHARED,
  ],
};
