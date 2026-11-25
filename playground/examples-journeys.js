// A journey for the gallery: password reset, with its error states.
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

export const JOURNEYS = [
  { id: 'password-reset', label: 'Password reset', body: PASSWORD_RESET },
];
