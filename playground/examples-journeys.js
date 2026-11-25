// Journeys for the gallery: password reset, phone onboarding, a support inbox.
// Plain strings: the page runs unbuilt, so no file reads.

const PASSWORD_RESET = `@device phone
@title "Password reset"
@flow sign-in request sent new-password done
screen sign-in "Sign in"
  navbar "Sign in"
  stack pad=24 gap=12
    input "Email" type=email
    input "Password" type=password #password
    button "Sign in" primary w=fill
    link "Forgot password?" -> request align=center

screen request "Reset your password"
  navbar "Reset password" back -> sign-in
  stack pad=24 gap=12
    text "We will email you a link that works for 30 minutes."
    input "Email" type=email #reset-email
    button "Send reset link" primary w=fill -> sent #send note="Same answer whether or not the address has an account"

variant request-invalid of request "Not an email address"
  #reset-email error="Enter an email address like name@company.com"
  #send disabled

screen sent "Check your inbox"
  stack pad=24 gap=12 align=center
    icon "mail"
    h2 "Check your inbox"
    text "If ada@acme.com has an account, the link is on its way." muted
    button "Open email app" primary w=fill
    link "Resend in 30 s" #resend note="Rate limit: 3 emails an hour per address"
    link "Use another email" -> request

screen new-password "Choose a new password"
  navbar "New password"
  stack pad=24 gap=12
    input "New password" type=password #new
    text "At least 12 characters." muted
    input "Repeat password" type=password #repeat
    button "Save and sign in" primary w=fill -> done #save

variant new-password-mismatch of new-password "Passwords differ"
  #repeat error="These passwords do not match"
  #save disabled

variant new-password-expired of new-password "Link expired"
  #repeat disabled
  #save disabled
  #new error="This link has expired. Ask for a new one"

screen done "Password changed"
  stack pad=24 gap=12 align=center
    icon "check"
    h2 "You are signed in"
    text "We signed you out on your other devices." muted
    button "Continue" primary w=fill`;

const MOBILE_ONBOARDING = `@device phone
@look clean
@title "Habit app onboarding"
@flow welcome goal reminders account home
screen welcome "Welcome"
  stack pad=32 gap=16 align=center
    image "Illustration: a streak calendar" h=280
    h1 "Build one habit at a time"
    text "Two minutes a day. We will remind you." muted align=center
    button "Get started" primary w=fill -> goal
    link "I already have an account" align=center

screen goal "Pick a goal"
  navbar "1 of 3" back -> welcome
  stack pad=24 gap=12
    h2 "What do you want to do daily?"
    radio "Read 10 pages" checked
    radio "Walk 20 minutes"
    radio "Write 3 lines in a journal"
    radio "Something else"
    button "Continue" primary w=fill -> reminders

screen reminders "Reminders"
  navbar "2 of 3" back -> goal
  stack pad=24 gap=12
    h2 "When should we remind you?"
    select "Time" options="7:00, 8:00, 12:30, 21:00" #time
    toggle "Weekends too" on
    button "Allow notifications" primary w=fill -> account #allow note="Ask for OS permission only after this tap, never on launch"
    link "Not now" -> account align=center

screen account "Save your progress"
  navbar "3 of 3" back -> reminders
  stack pad=24 gap=12
    h2 "Keep your streak on every device"
    button "Continue with Apple" icon=apple w=fill -> home
    button "Continue with Google" icon=google w=fill -> home
    button "Use email" icon=mail w=fill -> home
    link "Skip for now" -> home align=center note="Guest progress moves into the account later"

screen home "Today"
  navbar "Today"
  stack pad=24 gap=12
    card "Read 10 pages"
      row justify=between
        text "Day 1 of your streak"
        badge "New" tone=info
      button "Mark done" primary icon=check w=fill
  sheet "Nice start"
    text "Come back tomorrow at 8:00 to keep the streak."
    button "Got it" primary w=fill
  tabbar
    item "Today" icon=home selected
    item "Stats" icon=star
    item "Settings" icon=settings`;

const SUPPORT_INBOX = `@device desktop
@look clean
@title "Support inbox"
screen inbox "Inbox"
  navbar "Support"
  row gap=0 align=start
    stack pad=16 gap=8 w=360
      input "Search tickets" type=search
      tabs
        tab "Open · 14" selected
        tab "Mine · 3"
        tab "Solved"
      list #tickets
        item "Refund for double charge" "Maya · 4 min ago" icon=card selected -> ticket
        item "Cannot sign in with Google" "Tom · 18 min" icon=lock
        item "Export stuck at 90%" "Priya · 1 h" icon=download
        item "Invoice needs VAT number" "Lee · 3 h" icon=file
    divider
    stack pad=24 gap=12 grow=1
      h3 "Pick a ticket to read it here"
      text "Open tickets are sorted oldest first so no one waits twice." muted

screen ticket "Ticket"
  navbar "Support"
  row gap=0 align=start
    stack pad=16 gap=8 w=360
      input "Search tickets" type=search
      list
        item "Refund for double charge" "Maya · 4 min ago" icon=card selected
        item "Cannot sign in with Google" "Tom · 18 min" icon=lock
    divider
    stack pad=24 gap=12 grow=1
      row justify=between
        h2 "Refund for double charge"
        row gap=8
          badge "Billing" tone=info
          badge "Waiting on us" tone=warn #status
      text "Maya: I was charged twice for November. Order 4821 and 4822." #message
      card "Customer"
        text "Maya Chen · Pro since March · 12 seats"
        link "Open in billing" note="Opens the customer's invoices in a new tab"
      textarea "Reply to Maya" rows=4 #reply
      row gap=8 justify=end
        select "Then" options="Keep open, Mark solved, Wait on customer" #then
        button "Send reply" primary -> sent #send note="Ctrl+Enter sends"

variant ticket-empty-reply of ticket "Empty reply"
  #send disabled

screen sent "Reply sent"
  navbar "Support"
  stack pad=24 gap=12
    h2 "Refund for double charge"
    badge "Solved" tone=good
    text "Your reply was emailed to Maya." muted
    button "Next ticket" primary -> inbox
  toast "Reply sent · ticket solved" tone=good`;

export const JOURNEYS = [
  { id: 'password-reset', label: 'Password reset', body: PASSWORD_RESET },
  { id: 'mobile-onboarding', label: 'Mobile onboarding', body: MOBILE_ONBOARDING },
  { id: 'support-inbox', label: 'Support inbox', body: SUPPORT_INBOX },
];
