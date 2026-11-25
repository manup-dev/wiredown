// The playground's example gallery. Plain strings: the page runs unbuilt, so no file reads.
import { CONTRACT_EXAMPLE } from '../src/contract.js';

const SETTINGS = `@device phone
@look clean
@title "Team settings"
screen settings "Team settings"
  navbar "Settings" back -> home
  stack pad=20 gap=16
    row gap=12
      avatar "Ada Lovelace"
      stack gap=2
        h3 "Ada Lovelace"
        text "Admin · ada@company.com" muted
      spacer
      badge "Pro" tone=info
    tabs
      tab "Members" selected
      tab "Billing"
      tab "Security"
    input "Search members" type=search placeholder="Name or email"
    list
      item "Grace Hopper" "Editor" icon=user -> member
      item "Alan Turing" "Viewer · invited" icon=mail
      item "Katherine Johnson" "Admin" icon=user selected
    card "Notifications"
      toggle "Email me about new comments" on
      toggle "Weekly digest"
      checkbox "Only when I am mentioned" checked
    row gap=12
      button "Cancel" w=fill
      button "Save changes" primary w=fill note="Saves all three sections at once"
  tabbar
    item "Home" icon=home
    item "Team" icon=users selected
    item "Settings" icon=settings

screen home "Home"
  navbar "Home"
  stack pad=20 gap=16
    h1 "Good morning"
    text "Three documents changed since yesterday. Two need your review."
    grid cols=2 gap=12
      card "Drafts"
        h2 "12"
      card "In review"
        h2 "3"
    image "Weekly chart"
    table cols="Doc, Owner, Status" rows=3
    select "Workspace" options="Acme, Globex"
    textarea "Note" rows=3 placeholder="Write a note for the team"
    row gap=8
      badge "Live" tone=good icon=check
      badge "Late" tone=bad
      badge "Draft" muted
  toast "Saved" tone=good

screen member "Member"
  navbar "Grace Hopper" back -> settings
  stack pad=20 gap=16
    radio "Editor" checked
    radio "Viewer"
    button "Remove from team" icon=trash
    button "Saving" loading w=fill
  modal "Remove Grace?"
    text "She loses access to every document in this team."
    row gap=8 justify=end
      button "Cancel"
      button "Remove" primary`;

const ONBOARDING = `@device phone
@look clean
@title "Onboarding"
@flow welcome signin profile team done
screen welcome "Welcome"
  stack pad=24 gap=16
    image "Product illustration" h=180
    h1 "Plan work with your team" align=center
    text "Create a workspace in under a minute." align=center muted
    button "Get started" primary w=fill -> profile #start
    link "I already have an account" -> signin align=center

screen signin "Sign in"
  navbar "Sign in" back -> welcome
  stack pad=24 gap=16
    input "Email" type=email #signin-email
    input "Password" type=password #signin-password
    button "Sign in" primary w=fill

screen profile "Your profile"
  navbar "Step 1 of 2" back -> welcome
  stack pad=24 gap=16
    h2 "Tell us about you"
    row gap=12
      avatar "Add photo" note="Optional. Skipping keeps the initials avatar."
      stack gap=2 grow=1
        text "Profile photo"
        link "Upload"
    input "Full name" placeholder="Ada Lovelace" #name
    select "Role" options="Product, Design, Engineering, Other" #role
    button "Continue" primary w=fill -> team #profile-next

variant profile-error of profile "Name missing"
  #name error="Enter your name to continue"

screen team "Invite your team"
  navbar "Step 2 of 2" back -> profile
  stack pad=24 gap=16
    h2 "Who are you working with?"
    textarea "Emails" rows=3 placeholder="ana@acme.com, li@acme.com" #emails note="Comma separated. Invites are sent when you finish."
    checkbox "Let anyone at my company join" checked
    button "Finish" primary w=fill -> done
    link "Skip for now" -> done align=center

screen done "All set"
  stack pad=24 gap=16
    h1 "You are all set" align=center
    text "Your workspace is ready." align=center muted
    button "Open workspace" primary w=fill
  toast "Workspace created" tone=good`;

const CHECKOUT = `@device phone
@look clean
@title "Checkout"
@flow cart shipping payment confirmed
screen cart "Cart"
  navbar "Cart (2)"
  stack pad=20 gap=12
    card
      row gap=12
        image "Shoe" w=72 h=72
        stack gap=2 grow=1
          h3 "Trail runner"
          text "Size 42 · Blue" muted
        text "$89.00"
    card
      row gap=12
        image "Socks" w=72 h=72
        stack gap=2 grow=1
          h3 "Wool socks"
          text "Pack of 3" muted
        text "$18.00"
    row gap=8
      input "Promo code" w=fill #promo
      button "Apply"
    row justify=between
      h3 "Total"
      h3 "$107.00" #total
    button "Checkout" primary w=fill -> shipping #checkout note="Guests can check out without an account"

screen shipping "Shipping"
  navbar "Shipping" back -> cart
  stack pad=20 gap=12
    input "Full name" #ship-name
    input "Address" #ship-address
    row gap=12
      input "City" w=fill
      input "Postcode" w=fill
    radio "Standard (3-5 days)" checked
    radio "Express (1-2 days)"
    button "Continue to payment" primary w=fill -> payment

screen payment "Payment"
  navbar "Payment" back -> shipping
  stack pad=20 gap=12
    input "Card number" placeholder="1234 5678 9012 3456" #card
    row gap=12
      input "Expiry" placeholder="MM/YY" w=fill
      input "CVC" w=fill
    button "Pay $107.00" primary w=fill -> confirmed #pay note="Show the spinner while the bank confirms"

variant payment-declined of payment "Card declined"
  #card error="Your bank declined this card"

screen confirmed "Confirmed"
  stack pad=24 gap=16
    h1 "Thank you" align=center
    text "Order 4821 is on its way. A receipt is in your inbox." align=center muted
    button "Track order" primary w=fill
    link "Keep shopping" -> cart align=center
  sheet "Save this card?"
    text "Pay faster next time."
    row gap=8 justify=end
      button "Not now" -> cart
      button "Save card" primary`;

const ADMIN = `@device desktop
@look wire
@title "Admin: users"
@flow users user invite
screen users "Users"
  navbar "Admin"
  row gap=0
    stack pad=16 gap=8 w=200
      h3 "Acme"
      link "Users" -> users
      link "Billing"
      link "Audit log"
    stack pad=24 gap=16 grow=1
      row justify=between
        h2 "Users"
        button "Invite user" primary -> invite #invite-btn
      input "Search users" type=search placeholder="Name or email" #search
      table cols="Name, Email, Role, Status" rows=5 #user-table note="Row click opens the user"
      button "Open Grace Hopper" -> user

screen users-empty "No users yet"
  navbar "Admin" back -> users
  stack pad=48 gap=12
    h3 "No users yet" align=center
    text "Invite your first teammate to get started." align=center muted
    button "Invite your first teammate" primary -> invite

screen user "Grace Hopper"
  navbar "Admin" back -> users
  stack pad=24 gap=16
    row gap=12
      avatar "Grace Hopper"
      stack gap=2 grow=1
        h2 "Grace Hopper"
        text "grace@acme.com" muted
      badge "Active" tone=good
    select "Role" options="Admin, Editor, Viewer" #user-role
    toggle "Can export data" on
    row gap=8 justify=end
      button "Suspend"
      button "Delete user" icon=trash #delete note="Needs a second confirmation"
  modal "Delete Grace?"
    text "Her documents move to you. This cannot be undone."
    row gap=8 justify=end
      button "Cancel" -> users
      button "Delete" primary -> users

screen invite "Invite user"
  navbar "Admin" back -> users
  stack pad=24 gap=16
    h2 "Invite people"
    input "Email" type=email #invite-email
    select "Role" options="Admin, Editor, Viewer"
    row gap=8 justify=end
      button "Cancel" -> users
      button "Send invite" primary -> users

variant invite-error of invite "Invalid email"
  #invite-email error="Enter a valid email address"`;

export const EXAMPLES = [
  { id: 'sign-in', label: 'Sign in (the README example)', body: CONTRACT_EXAMPLE },
  { id: 'settings', label: 'Team settings', body: SETTINGS },
  { id: 'onboarding', label: 'Onboarding flow', body: ONBOARDING },
  { id: 'checkout', label: 'Checkout flow', body: CHECKOUT },
  { id: 'admin', label: 'Admin console', body: ADMIN },
];
