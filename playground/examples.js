// The playground's example gallery. Plain strings: the page runs unbuilt, so no file reads.
import { CONTRACT_EXAMPLE } from '../src/contract.js';
import { PRODUCT } from './examples-product.js';
import { JOURNEYS } from './examples-journeys.js';
import { SHOWCASE_A } from './examples-showcase.js';
import { SHOWCASE_B } from './examples-apps.js';

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

// `group` is the heading the Examples menu files each one under. The first is the default.
export const EXAMPLES = [
  ...[...SHOWCASE_A, ...SHOWCASE_B].map((e) => ({ ...e, group: 'Showcase' })),
  ...PRODUCT.map((e) => ({ ...e, group: 'States and variants' })),
  ...JOURNEYS.map((e) => ({ ...e, group: 'States and variants' })),
  { id: 'admin', label: 'Admin console', body: ADMIN, group: 'States and variants' },
  { id: 'sign-in', label: 'Sign in (the README example)', body: CONTRACT_EXAMPLE, group: 'Basics' },
];
