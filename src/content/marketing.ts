export const PLANS = [
  {
    name: "The Soloist",
    price: "$49",
    blurb: "For one-chair shops and solo operators.",
    features: ["Up to 100 calls/month", "Phone answering", "Calendar sync", "SMS confirmations"],
    popular: false,
  },
  {
    name: "Professional Shop",
    price: "$99",
    blurb: "For busy local businesses with a team.",
    features: [
      "Unlimited calls & DMs",
      "Instagram + Facebook DMs",
      "Custom knowledge base",
      "Priority appointment logic",
      "Outbound reminders",
    ],
    popular: true,
  },
  {
    name: "Multi-Location",
    price: "$199",
    blurb: "For owners running more than one shop.",
    features: ["Multiple calendars", "Team routing", "Centralized dashboard", "Dedicated account rep"],
    popular: false,
  },
] as const;

export const FEATURES = [
  { title: "Answers every call", body: "Picks up 24/7 in a natural voice, answers questions about your hours, prices and services, and never puts anyone on hold." },
  { title: "Replies to Instagram & Facebook DMs", body: "The same assistant handles messages, so customers who prefer to text get booked just as fast." },
  { title: "Books straight into your calendar", body: "Checks real availability per staff member and service, and never double-books a time slot." },
  { title: "Works in your timezone", body: "Every slot is shown in your business's local time, even for customers calling from elsewhere." },
  { title: "Speaks 12 languages", body: "Including Spanish, French, Arabic and more — customers are answered in the language they use." },
  { title: "Reminders and confirmations", body: "Sends SMS confirmations and reminders so fewer people forget their appointment." },
  { title: "Live public schedule", body: "Share a schedule page that updates the moment an appointment is booked or moved." },
  { title: "Team and multi-location", body: "Filter staff by role and location, invite teammates, and run several shops from one place." },
] as const;

export interface Industry {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  pains: string[];
  examples: string[];
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "salons",
    name: "Hair & beauty salons",
    headline: "Keep cutting. We'll answer the phone.",
    intro: "Stylists can't pick up mid-color. FrontDesk AI answers every call and DM, books the right stylist for the right service, and fills cancellations fast.",
    pains: ["Missed calls while hands are busy", "Clients DMing on Instagram after hours", "Last-minute gaps in the book"],
    examples: ["\"Can I get a balayage with Maria on Saturday?\"", "\"How much is a men's cut?\"", "\"Do you have anything earlier today?\""],
  },
  {
    slug: "barbershops",
    name: "Barbershops",
    headline: "Every chair full, no phone on the counter.",
    intro: "Walk-ins and regulars both get answered instantly. FrontDesk AI shows the next open slots per barber and books them without you stopping a fade.",
    pains: ["Phone ringing during cuts", "Regulars wanting their usual barber", "No-shows on busy days"],
    examples: ["\"When's Jay free next?\"", "\"Book me a beard trim Friday at 5\"", "\"Are you open Sunday?\""],
  },
  {
    slug: "clinics",
    name: "Clinics & wellness",
    headline: "A calm front desk, even on the busiest morning.",
    intro: "From physio to dental to massage, FrontDesk AI handles booking and rescheduling calls so your team can focus on patients in the room.",
    pains: ["Reception overwhelmed at opening time", "Reschedule requests eating staff time", "After-hours calls going to voicemail"],
    examples: ["\"I need to move my Tuesday appointment\"", "\"Do you take new patients?\"", "\"What time do you close today?\""],
  },
  {
    slug: "home-services",
    name: "Home services",
    headline: "Book the job while you're on the job.",
    intro: "Plumbers, cleaners, electricians and landscapers lose work when calls go unanswered. FrontDesk AI captures every request and books it into your schedule.",
    pains: ["Calls missed on site", "Leads going to the next company that answers", "Scheduling done from a truck"],
    examples: ["\"Can someone look at a leak tomorrow?\"", "\"Do you service my area?\"", "\"How soon can you come out?\""],
  },
];

export const getIndustry = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);
