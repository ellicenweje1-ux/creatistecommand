import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Brand, Button } from '../ui'
import { VersionStamp } from '../version'

/* The Terms of Service and Privacy Policy share one layout. These are plain-English,
   UK-oriented templates written for The Creatiste Command — Ellice should have them
   reviewed by a solicitor and add her registered business details before relying on
   them in a dispute. The "last updated" date below should change whenever the text does. */
const UPDATED = '14 June 2026'

function useSupportEmail() {
  const [email, setEmail] = useState('')
  useEffect(() => { api.get('/auth/config').then((c) => setEmail(c.support_email || '')).catch(() => {}) }, [])
  return email
}

function LegalLayout({ title, lead, updated = UPDATED, children }) {
  return (
    <div className="min-h-screen bg-base">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/"><Brand /></Link>
        <Link to="/"><Button variant="ghost" size="sm">← Home</Button></Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-4">
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-fg/45">Last updated {updated}</p>}
        {lead && <p className="mt-5 text-[15px] leading-relaxed text-fg/70">{lead}</p>}
        <div className="mt-2">{children}</div>
        <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-6 text-sm">
          <Link to="/faq" className="font-medium text-copper hover:underline">FAQs</Link>
          <Link to="/terms" className="font-medium text-copper hover:underline">Terms of Service</Link>
          <Link to="/privacy" className="font-medium text-copper hover:underline">Privacy Policy</Link>
          <Link to="/" className="font-medium text-copper hover:underline">Home</Link>
        </div>
        <div className="mt-6"><VersionStamp /></div>
      </main>
    </div>
  )
}

function Section({ n, heading, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{n != null && <span className="text-copper">{n}. </span>}{heading}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-fg/70">{children}</div>
    </section>
  )
}

function Bullets({ items }) {
  return (
    <ul className="ml-1 space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-copper/70" />{it}</li>
      ))}
    </ul>
  )
}

export function Terms() {
  const email = useSupportEmail()
  return (
    <LegalLayout
      title="Terms of Service"
      lead={
        <>
          These terms are the agreement between you and The Creatiste Command (“we”, “us”, “our”),
          a service operated by Ellice Nweje, for use of our chef and catering management platform (the “Service”).
          Please read them carefully — by creating an account or using the Service you agree to them.
        </>
      }
    >
      <Section n={1} heading="Who we are">
        <p>
          The Creatiste Command is a subscription software platform for private chefs, caterers and culinary
          professionals, operated from the United Kingdom by Ellice Nweje. Where these terms mention the “Service”,
          we mean the website, web app, installable mobile app and related features. You can reach us at{' '}
          {email ? <a href={`mailto:${email}`} className="text-copper">{email}</a> : 'our support address'}.
        </p>
      </Section>
      <Section n={2} heading="Accepting these terms">
        <p>
          By registering for, accessing or using the Service you confirm that you accept these terms and agree to
          comply with them. If you are using the Service on behalf of a business, you confirm you have authority to
          bind that business, and “you” means that business. If you do not agree, please do not use the Service.
        </p>
      </Section>
      <Section n={3} heading="Eligibility and your account">
        <Bullets items={[
          'You must be at least 18 years old and able to enter into a contract.',
          'You are responsible for the information you provide and for keeping it accurate.',
          'You are responsible for keeping your password secure and for all activity under your account, including the staff logins you create.',
          'Tell us promptly if you believe your account has been accessed without your permission.',
        ]} />
      </Section>
      <Section n={4} heading="Onboarding, free trial and membership">
        <p>
          Every new account begins with a personal onboarding session, which we must mark complete before your
          workspace unlocks. A free trial (the length is shown when you sign up) begins when your onboarding is
          completed. After the trial you must choose a paid membership to continue using the Service.
        </p>
        <p>
          Memberships are offered on monthly tiers, plus a one-time onboarding fee. Current prices and what each
          tier includes are shown on our pricing page and may change for future billing periods (see section 12).
          Some accounts are on a separate Founders membership at an agreed rate.
        </p>
      </Section>
      <Section n={5} heading="Fees, billing and payment">
        <Bullets items={[
          'Payments are processed by our payment provider, Stripe. By subscribing you also agree to Stripe’s terms, and you authorise recurring charges to your chosen payment method.',
          'Memberships renew automatically each month until cancelled. The onboarding fee is a one-time charge.',
          'Prices are shown in pounds sterling (GBP) unless stated otherwise and, where applicable, are inclusive of or subject to VAT.',
          'If a payment fails we may retry it and may suspend access until your account is brought up to date.',
        ]} />
      </Section>
      <Section n={6} heading="Cancellation, suspension and refunds">
        <p>
          You can cancel your membership at any time from your account settings or by contacting us. When you cancel,
          your membership stays active until the end of the period you have already paid for, and it will not renew
          again after that.
        </p>
        <p>
          Except where the law gives you a right to a refund, fees already paid (including the onboarding fee and the
          current month’s membership) are non-refundable. We may suspend or limit your access if you breach these
          terms or if payment is overdue.
        </p>
      </Section>
      <Section n={7} heading="Your content and data">
        <p>
          You keep ownership of everything you put into the Service — your recipes, bookings, client records, lists,
          designs and other content (“Your Content”). You grant us the limited permission needed to host, process,
          back up and display Your Content so that we can provide the Service to you.
        </p>
        <p>
          You are responsible for Your Content and for having the right to use it, including any personal data about
          your own clients and staff. How we handle personal data is set out in our{' '}
          <Link to="/privacy" className="text-copper">Privacy Policy</Link>.
        </p>
      </Section>
      <Section n={8} heading="Food safety, allergens and professional responsibility">
        <p>
          The Service includes tools that help you plan menus, record recipes, generate allergen matrices, build
          shopping and prep lists, and (where enabled) AI suggestions from “Mise”. These tools are aids to your own
          professional judgement — they are not a substitute for it.
        </p>
        <p>
          You remain solely responsible for food safety, allergen accuracy, labelling, hygiene and for complying with
          all laws and regulations that apply to your business (including UK food law and Natasha’s Law). Always verify
          allergen and ingredient information against your actual products and suppliers before relying on it. We are
          not responsible for the accuracy of information you enter or for decisions you make using the Service.
        </p>
      </Section>
      <Section n={9} heading="Acceptable use">
        <p>You agree not to:</p>
        <Bullets items={[
          'use the Service for anything unlawful, fraudulent or harmful;',
          'upload content that infringes someone else’s rights or that you have no right to share;',
          'attempt to gain unauthorised access to the Service, other accounts, or our systems;',
          'interfere with, overload or disrupt the Service, or try to copy, resell or reverse-engineer it.',
        ]} />
      </Section>
      <Section n={10} heading="Availability, support and changes to the Service">
        <p>
          We work hard to keep the Service available, but we provide it “as is” and cannot guarantee it will always be
          uninterrupted or error-free. We may carry out maintenance, and we may add, change or remove features over
          time. We offer support through the in-app Help &amp; FAQs and our support contact.
        </p>
      </Section>
      <Section n={11} heading="Intellectual property">
        <p>
          The Service itself — its software, design, branding and content we create — belongs to us or our licensors
          and is protected by intellectual-property laws. These terms do not give you any rights in it except the
          right to use the Service in line with these terms. Your Content remains yours.
        </p>
      </Section>
      <Section n={12} heading="Disclaimers and limitation of liability">
        <p>
          Nothing in these terms excludes or limits our liability where it would be unlawful to do so — this includes
          liability for death or personal injury caused by our negligence, or for fraud.
        </p>
        <p>
          Subject to that, we are not liable for losses that were not reasonably foreseeable, for loss of profit, data
          or business, or for losses caused by your own failure to follow professional, food-safety or legal
          obligations. To the extent permitted by law, our total liability to you in any 12-month period is limited to
          the amount you paid us for the Service in that period.
        </p>
      </Section>
      <Section n={13} heading="Ending your access">
        <p>
          You can stop using the Service and close your account at any time. We may suspend or end your access if you
          seriously or repeatedly breach these terms, if required by law, or if we stop providing the Service. After
          your account ends we may delete Your Content in line with our Privacy Policy — please export anything you
          want to keep beforehand.
        </p>
      </Section>
      <Section n={14} heading="Changes to these terms">
        <p>
          We may update these terms from time to time. If we make a significant change we will take reasonable steps to
          let you know. Continuing to use the Service after a change means you accept the updated terms. The date at the
          top shows when these terms were last updated.
        </p>
      </Section>
      <Section n={15} heading="Governing law">
        <p>
          These terms are governed by the laws of England and Wales, and disputes are subject to the exclusive
          jurisdiction of the courts of England and Wales.
        </p>
      </Section>
      <Section n={16} heading="Contact us">
        <p>
          Questions about these terms? Email us at{' '}
          {email ? <a href={`mailto:${email}`} className="text-copper">{email}</a> : 'our support address'} and we’ll be
          glad to help.
        </p>
      </Section>
    </LegalLayout>
  )
}

export function Privacy() {
  const email = useSupportEmail()
  return (
    <LegalLayout
      title="Privacy Policy"
      lead={
        <>
          This policy explains what personal information The Creatiste Command collects, how we use and protect it,
          and the rights you have. It applies to chefs and caterers who use our platform and to visitors to our site.
          We are committed to handling personal data responsibly and in line with UK data protection law.
        </>
      }
    >
      <Section n={1} heading="Who we are and how to contact us">
        <p>
          For the personal data we hold about your own account, the data controller is The Creatiste Command, operated
          by Ellice Nweje in the United Kingdom. You can contact us about privacy at{' '}
          {email ? <a href={`mailto:${email}`} className="text-copper">{email}</a> : 'our support address'}.
        </p>
      </Section>
      <Section n={2} heading="The information we collect">
        <Bullets items={[
          'Account details: your name, business name, email address, phone number and password (stored only as a secure hash).',
          'Business data you enter: bookings, recipes, inventory, shopping and packing lists, tasks, routes, designs, quotes, invoices and notes.',
          'Client and staff records you add: contact details and preferences for your own clients, and logins you create for your staff.',
          'Payment information: handled by Stripe. We receive confirmation of payments and limited details (such as the last four digits and card type), but we do not store full card numbers.',
          'Support and onboarding information: messages you send us, and notes or transcripts from onboarding and check-in calls.',
          'Technical data: basic information needed to run the app, such as your login session token and locally cached data for offline use.',
        ]} />
      </Section>
      <Section n={3} heading="How and why we use your information">
        <p>We use personal data to:</p>
        <Bullets items={[
          'provide, maintain and improve the Service and your account (our legal basis: performance of our contract with you);',
          'take payment and manage memberships (performance of our contract, and compliance with legal obligations such as tax record-keeping);',
          'provide support, run onboarding calls and respond to your requests (our legitimate interests in running the Service well, and our contract with you);',
          'keep the Service secure and prevent misuse (our legitimate interests);',
          'send you service-related messages; any optional marketing would only be with your consent.',
        ]} />
      </Section>
      <Section n={4} heading="Personal data about your clients and staff">
        <p>
          When you add information about your own clients or staff, you are the data controller for that information and
          we act as your data processor — we process it only to provide the Service to you and on your instructions. You
          are responsible for having a lawful basis to enter that data and for telling those individuals how their data
          is used. We are happy to support reasonable data requests relating to it.
        </p>
      </Section>
      <Section n={5} heading="Who we share information with">
        <p>We do not sell your personal data. We share it only with trusted providers who help us run the Service, including:</p>
        <Bullets items={[
          'Stripe — payment processing and billing;',
          'our hosting and infrastructure provider, which stores the platform and its database;',
          'our email provider, used to send service and notification emails when configured;',
          'Anthropic — only if you use the optional AI features (“Mise”), the relevant content is sent to generate a response, and is not used to train their models;',
          'our video-call provider (Zoom or a private meeting room) for onboarding and check-in calls.',
        ]} />
        <p>We may also share information where we are legally required to, or to protect our rights and the safety of others.</p>
      </Section>
      <Section n={6} heading="International transfers">
        <p>
          Some of our providers are based outside the UK, including in the United States. Where personal data is
          transferred outside the UK, we rely on appropriate safeguards (such as UK-approved standard contractual
          clauses or an adequacy decision) so that your data stays protected.
        </p>
      </Section>
      <Section n={7} heading="How long we keep information">
        <p>
          We keep your account and business data for as long as your account is active. After your account is closed we
          delete or anonymise personal data within a reasonable period, except where we need to keep certain records
          (for example, payment and tax records) to meet legal obligations. You can ask us to delete your account data
          at any time.
        </p>
      </Section>
      <Section n={8} heading="How we protect your information">
        <p>
          We use technical and organisational measures to protect personal data, including encryption in transit,
          hashed passwords and access controls. No system can be guaranteed completely secure, but we take security
          seriously and review our measures over time.
        </p>
      </Section>
      <Section n={9} heading="Cookies and local storage">
        <p>
          We keep the Service light on tracking. We use essential local storage in your browser to keep you logged in
          and to let the app work offline (caching your own data on your device). We do not use advertising cookies. The
          offline cache is cleared when you log out.
        </p>
      </Section>
      <Section n={10} heading="Your rights">
        <p>Under UK data protection law you have the right to:</p>
        <Bullets items={[
          'access the personal data we hold about you;',
          'have inaccurate data corrected;',
          'have your data deleted in certain circumstances;',
          'restrict or object to certain processing;',
          'receive your data in a portable format;',
          'withdraw consent where we relied on it.',
        ]} />
        <p>
          To exercise any of these, contact us at{' '}
          {email ? <a href={`mailto:${email}`} className="text-copper">{email}</a> : 'our support address'}. You also have
          the right to complain to the UK’s Information Commissioner’s Office (ICO) at ico.org.uk, though we’d
          appreciate the chance to put things right first.
        </p>
      </Section>
      <Section n={11} heading="Children">
        <p>The Service is intended for professional use by adults and is not directed at children under 18.</p>
      </Section>
      <Section n={12} heading="Changes to this policy">
        <p>
          We may update this policy from time to time. The date at the top shows when it was last updated, and we will
          take reasonable steps to tell you about significant changes.
        </p>
      </Section>
      <Section n={13} heading="Contact us">
        <p>
          For any privacy question or request, email{' '}
          {email ? <a href={`mailto:${email}`} className="text-copper">{email}</a> : 'our support address'}.
        </p>
      </Section>
    </LegalLayout>
  )
}

/* Public, pre-sign-up FAQ — deliberately short. Detailed, in-app help lives on the
   Support page once someone has an account; this is just enough to decide to join. */
export function Faq() {
  const email = useSupportEmail()
  return (
    <LegalLayout
      updated={null}
      title="Frequently asked questions"
      lead={
        <>
          The short version of what The Creatiste Command is and how it works — for anyone deciding whether to join.
          Want the full picture? Start your free trial or get in touch, and we’ll show you the rest.
        </>
      }
    >
      <Section heading="What is The Creatiste Command?">
        <p>
          A complete management platform and one-stop shop built for private chefs, caterers and culinary
          professionals — your bookings, recipes, stock, shopping, prep, clients, quotes and invoices in one
          command centre, designed to be used on the move.
        </p>
      </Section>
      <Section heading="Who is it for?">
        <p>
          Independent chefs and catering businesses of every size — from a solo private chef to a team with staff.
          You pick the membership that matches how you work today and move up as you grow.
        </p>
      </Section>
      <Section heading="What can it actually do?">
        <p>Everything between the enquiry and the final plate, including:</p>
        <Bullets items={[
          'Bookings, an event calendar and a leads pipeline;',
          'Recipes, inventory with shelf-life alerts and an allergen matrix;',
          'Multi-shop shopping lists, packing checklists and a prep-day route planner;',
          'Clients, tastings, quotes your client approves from their phone, and invoicing;',
          'Staff logins with rotas, and an AI sous-chef on the top tier.',
        ]} />
      </Section>
      <Section heading="How much does it cost?">
        <p>
          There are three monthly membership tiers plus a one-time onboarding fee. You can see the current prices
          and exactly what each tier includes on our <Link to="/" className="text-copper">home page</Link>.
        </p>
      </Section>
      <Section heading="Is there a free trial?">
        <p>
          Yes. After you sign up and complete your onboarding call, a free trial begins — no card needed for the
          trial. When it ends, you choose a membership to carry on, and everything you added stays.
        </p>
      </Section>
      <Section heading="What is the onboarding session?">
        <p>
          A short, personal video call to set up and verify your kitchen before your workspace opens — so the
          platform fits the way you work from day one.
        </p>
      </Section>
      <Section heading="Do I need to download or install anything?">
        <p>
          No. It runs in any web browser on phone, tablet or laptop. You can also install it as an app and keep
          working offline — your changes sync when you’re back online.
        </p>
      </Section>
      <Section heading="Is my information private and secure?">
        <p>
          Yes. Your data is yours — you can export it at any time — and we handle it in line with UK data
          protection law. The details are in our <Link to="/privacy" className="text-copper">Privacy Policy</Link>.
        </p>
      </Section>
      <Section heading="What if I delete something by mistake?">
        <p>
          You can put it back yourself. Anything you delete goes to a “Recently deleted” area for 30 days, so a
          mis-tap is never the end of your work — just tap Restore. Your kitchen is also backed up regularly behind
          the scenes, so your records are kept safe.
        </p>
      </Section>
      <Section heading="Can I cancel any time?">
        <p>
          Yes. Cancel from your account settings whenever you like; your membership stays active until the end of
          the period you’ve already paid for. The full detail is in our{' '}
          <Link to="/terms" className="text-copper">Terms</Link>.
        </p>
      </Section>
      <Section heading="Still have questions?">
        <p>
          The best way to see if it’s right for you is to try it. Create your account to explore, or email us at{' '}
          {email ? <a href={`mailto:${email}`} className="text-copper">{email}</a> : 'our support address'} and we’ll help.
        </p>
        <div className="pt-1">
          <Link to="/register"><Button>Start your free trial</Button></Link>
        </div>
      </Section>
    </LegalLayout>
  )
}
