// Product flows for the gallery: a dashboard in its four states, an upgrade.
// Plain strings: the page runs unbuilt, so no file reads.

const DASHBOARD_STATES = `@device desktop
@look clean
@title "Projects dashboard and its states"
@flow first-run projects new-project
screen first-run "First visit"
  navbar "Acme · Projects"
  stack pad=48 gap=16 align=center
    icon "file"
    h2 "No projects yet"
    text "Projects group the docs, owners and dates for one goal." muted
    button "Create your first project" primary -> new-project
    link "Import from a spreadsheet" note="CSV with name, owner and due date columns"

screen projects "Projects"
  navbar "Acme · Projects"
  stack pad=24 gap=16
    row justify=between
      h1 "Projects"
      row gap=8
        input "Search projects" type=search #search
        button "Refresh" #refresh
        button "New project" primary icon=plus -> new-project
    row gap=16 #kpis
      card "Active"
        h1 "12"
        badge "+3 this week" tone=good
      card "At risk"
        h1 "2"
        badge "Needs review" tone=warn #risk
      card "Shipped"
        h1 "41"
        badge "This quarter" muted
    table cols="Project, Owner, Status, Due" rows=5 #table note="Overdue rows first, then by due date"

variant projects-loading of projects "Loading"
  #refresh loading
  #kpis hide
  #table hide

variant projects-search of projects "Search with no results"
  #search placeholder="checkout redesign"
  #kpis hide
  #table hide

screen new-project "New project"
  navbar "New project" back -> projects
  stack pad=24 gap=12 w=560
    input "Project name" #name
    select "Owner" options="Ada, Grace, Linus"
    input "Due date" placeholder="DD/MM/YYYY"
    textarea "Goal" rows=3 note="One sentence; it shows on the project card"
    row gap=8 justify=end
      button "Cancel" -> projects
      button "Create project" primary -> projects`;

const UPGRADE_PAYWALL = `@device desktop
@look clean
@title "Upgrade at the limit"
@flow editor limit plans pay upgraded
screen editor "Editor"
  navbar "Q4 roadmap"
  stack pad=24 gap=12
    h1 "Q4 roadmap"
    text "Draft · saved 2 minutes ago" muted
    button "Export to PDF" icon=download -> limit #export note="PDF export is a Pro feature"

screen limit "Pro feature"
  navbar "Q4 roadmap"
  stack pad=24 gap=12
    h1 "Q4 roadmap"
  modal "Export to PDF is on Pro"
    text "Pro adds PDF export, unlimited projects and 90 days of history."
    row gap=8 justify=end
      button "Not now" -> editor
      button "See plans" primary -> plans

screen plans "Plans"
  navbar "Choose a plan" back -> editor
  stack pad=32 gap=24 align=center
    h1 "Pick the plan for your team"
    tabs
      tab "Monthly" selected #monthly
      tab "Yearly · save 20%" #yearly note="Yearly shows the per-month price and the yearly total"
    grid cols=3 gap=16
      card "Free"
        h2 "$0"
        text "3 projects, 7 days of history" muted
        button "Current plan" disabled w=fill
      card "Pro"
        badge "Most popular" tone=info
        h2 "$5 per seat" #pro-price
        text "PDF export, unlimited projects, 90 days of history" muted
        button "Upgrade" primary w=fill -> pay
      card "Enterprise"
        h2 "Let's talk"
        text "SSO, audit export, invoicing" muted
        button "Contact sales" w=fill

screen pay "Payment"
  navbar "Upgrade to Pro" back -> plans
  stack pad=32 gap=12 w=520
    text "5 seats × $5 = $25 a month" #total
    input "Card number" placeholder="1234 5678 9012 3456" #card
    row gap=12
      input "Expiry" placeholder="MM/YY" w=fill
      input "CVC" w=fill
    button "Pay $25 and upgrade" primary w=fill -> upgraded #pay note="Prorated today; renews on the 1st"

variant pay-declined of pay "Card declined"
  #card error="Your bank declined this card. Try another one"

variant pay-processing of pay "Processing"
  #pay loading

screen upgraded "Upgraded"
  navbar "Q4 roadmap"
  stack pad=24 gap=12
    h1 "Q4 roadmap"
    button "Export to PDF" icon=download primary
  toast "Welcome to Pro. PDF export is ready" tone=good`;

export const PRODUCT = [
  { id: 'dashboard-states', label: 'Dashboard: empty, loading, no results', body: DASHBOARD_STATES },
  { id: 'upgrade-paywall', label: 'Upgrade at the limit', body: UPGRADE_PAYWALL },
];
