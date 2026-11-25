// The showcase, part one: a SaaS dashboard, a shop checkout and a phone onboarding. Each is a
// flow that plays under Play: every screen linked, icons, typed images and a motion.
// Plain strings: the page runs unbuilt, so no file reads.

const SAAS_DASHBOARD = `@device 1024x720
@look clean
@title "Analytics dashboard"
@motion fade
screen sign-in "Sign in"
  stack pad=40 align=center justify=center h=fill
    card w=400
      stack pad=8 gap=14
        row gap=10
          image "A" type=logo w=40 h=40
          h3 "Acme Analytics"
        h2 "Welcome back"
        text "Sign in to see this week's numbers." muted
        button "Continue with Google" icon=google w=fill
        divider
        input "Work email" type=email placeholder="ada@acme.com"
        input "Password" type=password
        button "Sign in" primary w=fill -> dashboard note="Opens the workspace you used last"
        link "Forgot password?" align=center
    text "New to Acme? Start a free workspace." muted

screen dashboard "Dashboard"
  navbar "Acme Analytics"
  row gap=0 grow=1 align=start
    stack pad=16 gap=8 w=200
      list
        item "Overview" icon=home selected
        item "Customers" icon=users
        item "Reports" icon=file
        item "Alerts" icon=bell
        item "Settings" icon=settings -> settings
    stack pad=24 gap=16 grow=1
      row justify=between
        h2 "Overview"
        row gap=8
          button "Last 30 days" icon=calendar
          button "Export" icon=download
      grid cols=3 gap=12
        card "Revenue"
          h2 "$48,210"
          badge "+12% this month" tone=good
        card "Active users"
          h2 "3,904"
          badge "+4% this month" tone=good
        card "Churn"
          h2 "1.8%"
          badge "Up 0.3 points" tone=warn
      row gap=12
        image "Revenue by week" type=chart grow=2 h=190
        image "Customers by region" type=map grow=1 h=190
      table cols="Customer, Plan, MRR, Status" rows=3

screen settings "Settings" motion=push
  navbar "Settings" back -> dashboard
  stack pad=24 gap=16
    tabs
      tab "Profile" selected
      tab "Team"
      tab "Billing"
    row gap=16
      avatar "Ada Lovelace"
      stack gap=10 grow=1
        input "Full name" placeholder="Ada Lovelace"
        input "Email" type=email placeholder="ada@acme.com"
    card "Email reports"
      toggle "Weekly summary every Monday" on
      toggle "Alert me when churn passes 2%"
      checkbox "Include the revenue chart" checked
    card "Security"
      toggle "Two step sign in" on
      text "Asks for a code from your phone on a new computer." muted
    row gap=8 justify=end
      button "Cancel" -> dashboard
      button "Save changes" primary -> dashboard`;

const SHOP_CHECKOUT = `@device phone fit
@look clean
@title "Shop checkout"
@motion push
screen product "Product"
  navbar "Trail runner" back
  stack pad=20 gap=12
    image "Trail runner, blue" type=photo ratio=4:3
    row justify=between
      h2 "Trail runner"
      h2 "$89"
    row gap=6
      icon "star"
      text "4.0 · 312 reviews" muted
    select "Size" options="40, 41, 42, 43, 44" placeholder="Choose a size"
    button "Add to cart" primary w=fill icon=shopping-cart -> cart
    button "Save for later" icon=heart w=fill

screen cart "Cart"
  navbar "Cart (2)" back -> product
  stack pad=20 gap=12
    card
      row gap=12
        image "Shoe" type=photo ratio=1:1 w=72
        stack gap=2 grow=1
          h3 "Trail runner"
          text "Size 42 · Blue" muted
        text "$89.00"
    card
      row gap=12
        image "Socks" type=photo ratio=1:1 w=72
        stack gap=2 grow=1
          h3 "Wool socks"
          text "Pack of 3" muted
        text "$18.00"
    input "Promo code" placeholder="SPRING10"
    row justify=between
      text "Delivery" muted
      text "Free, arrives Friday" muted
    row justify=between
      h3 "Total"
      h3 "$107.00"
    button "Checkout" primary w=fill icon=lock -> pay

screen pay "Pay" motion=sheet
  navbar "Payment" back -> cart
  stack pad=20 gap=12
    card
      row justify=between
        text "Trail runner, Wool socks" muted
        h3 "$107.00"
      text "Ships to 12 Rua Augusta, Lisbon" muted
    button "Pay with Apple Pay" icon=apple w=fill
    divider
    input "Card number" placeholder="1234 5678 9012 3456"
    row gap=12
      input "Expiry" placeholder="MM/YY" w=fill
      input "CVC" w=fill
    checkbox "Save this card for next time" checked
    button "Pay $107.00" primary w=fill -> done note="Shows a spinner while the bank confirms"

screen done "Order placed" motion=zoom
  stack pad=24 gap=16 align=center
    icon "check-circle"
    h1 "Thank you" align=center
    text "Order 4821 arrives on Friday. The receipt is in your inbox." align=center muted
    card w=fill
      row gap=12
        image "Shoe" type=photo ratio=1:1 w=56
        stack gap=2 grow=1
          h3 "Trail runner"
          text "Size 42 · Blue" muted
      row gap=12
        image "Socks" type=photo ratio=1:1 w=56
        stack gap=2 grow=1
          h3 "Wool socks"
          text "Pack of 3" muted
    button "Track order" primary w=fill
    link "Keep shopping" -> product`;

const MOBILE_ONBOARDING = `@device phone fit
@look clean
@title "Phone onboarding"
@motion slide
@flow welcome plan share sign-up
screen welcome "Welcome"
  stack pad=24 gap=16
    row justify=end
      link "Skip" -> sign-up
    image "People planning a trip together" type=illustration ratio=1:1
    h1 "Plan trips with friends" align=center
    text "One list for flights, stays and who pays for what." align=center muted
    button "Next" primary w=fill -> plan

screen plan "Plan"
  stack pad=24 gap=16
    row justify=end
      link "Skip" -> sign-up
    image "A shared itinerary" type=illustration ratio=1:1
    h1 "Everyone sees the plan" align=center
    text "Changes show up for the whole group at once." align=center muted
    button "Next" primary w=fill -> share

screen share "Share costs"
  stack pad=24 gap=16
    image "Splitting a bill" type=illustration ratio=1:1
    h1 "Split costs fairly" align=center
    text "See who owes what, and settle up in one tap." align=center muted
    button "Get started" primary w=fill -> sign-up

screen sign-up "Create your account" motion=sheet
  navbar "Sign up" back -> share
  stack pad=24 gap=14
    h1 "Create your account"
    text "Free for groups of up to 8." muted
    button "Continue with Apple" icon=apple w=fill
    button "Continue with Google" icon=google w=fill
    divider
    input "Email" type=email placeholder="you@example.com" #email
    input "Password" type=password
    button "Create account" primary w=fill
    text "By signing up you agree to the terms." align=center muted`;

export const SHOWCASE_A = [
  { id: 'saas-dashboard', label: 'SaaS dashboard', body: SAAS_DASHBOARD },
  { id: 'shop-checkout', label: 'Shop checkout', body: SHOP_CHECKOUT },
  { id: 'mobile-onboarding', label: 'Phone onboarding', body: MOBILE_ONBOARDING },
];
