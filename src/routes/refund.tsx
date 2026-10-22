import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { canonicalLink, pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: pageMeta({ title: "Refund Policy — FrontDesk AI", description: "How to request a FrontDesk AI refund through Paddle and cancel your subscription or trial.", path: "/refund" }).filter((tag) => !("property" in tag && tag.property.startsWith("og:image")) && !("name" in tag && tag.name === "twitter:image")),
    links: [canonicalLink("/refund")],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <LegalPage title="Refund Policy">
      <section><h2>Refunds through Paddle</h2><p>FrontDesk AI purchases are sold by Paddle, our Merchant of Record. We use <a href="https://www.paddle.com/legal/refund-policy">Paddle’s Refund Policy</a> for refund eligibility, applicable request periods and processing. That policy forms part of our purchase terms. Your statutory consumer rights remain unaffected.</p></section>
      <section><h2>How to request a refund</h2><p>Visit <a href="https://paddle.net">paddle.net</a> to request a refund or get help with a payment. Use the email address from your order and provide your transaction or receipt details so Paddle can locate your purchase. Paddle handles refund decisions and returns under its policy and applicable law. You can also contact FrontDesk AI through our <Link to="/contact">contact page</Link> for help identifying your purchase.</p></section>
      <section><h2>Trials and cancellation</h2><p>If your checkout includes a 14-day free trial, cancel before the trial ends to avoid the first subscription charge. Cancel or manage your subscription through <a href="https://paddle.net">Paddle customer support</a>. Cancellation stops future renewal according to Paddle’s Buyer Terms; a refund request is handled separately under Paddle’s Refund Policy.</p></section>
      <section><h2>Related purchase terms</h2><p>Read our <Link to="/terms">Terms &amp; Conditions</Link> and <a href="https://www.paddle.com/legal/checkout-buyer-terms">Paddle’s Buyer Terms</a> for payment, tax, renewal and cancellation mechanics. For questions about the FrontDesk AI service rather than a transaction, <Link to="/contact">contact FrontDesk AI</Link>.</p></section>
    </LegalPage>
  );
}